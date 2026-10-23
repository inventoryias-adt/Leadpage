import 'server-only';
import { BusinessError } from './claims';
import { prisma } from './db';
import { commissionOf, lastMonths, monthBounds, monthRange, occurrencesIn, parseEntry, shiftMonth, type EntryRow, type Occurrence } from './finance';

const BRT = `'America/Sao_Paulo'`;
const dateKey = (d: Date) => d.toISOString().slice(0, 10); // colunas DATE vêm como meia-noite UTC: o texto já é o dia

type Row = { month: string; cents: bigint | number | null; n: bigint | number | null };
const num = (v: bigint | number | null | undefined) => Number(v ?? 0);

export const toEntryRow = (e: { id: string; kind: string; description: string; category: string; amountCents: number; date: Date; recurrence: string; endsOn: Date | null }): EntryRow => ({
  id: e.id, kind: e.kind as EntryRow['kind'], description: e.description, category: e.category, amountCents: e.amountCents,
  date: dateKey(e.date), recurrence: e.recurrence as EntryRow['recurrence'], endsOn: e.endsOn ? dateKey(e.endsOn) : null,
});

/** Todos os lançamentos manuais que podem cair nos meses pedidos (avulsos do período e fixos já iniciados). */
async function entriesFor(restaurantId: string, months: string[]) {
  const last = months[months.length - 1];
  const first = `${months[0]}-01`;
  const rows = await prisma.financeEntry.findMany({
    where: { restaurantId, date: { lte: new Date(`${monthBounds(last).last}T00:00:00Z`) }, OR: [{ recurrence: 'MONTHLY', OR: [{ endsOn: null }, { endsOn: { gte: new Date(`${first}T00:00:00Z`) } }] }, { recurrence: 'NONE', date: { gte: new Date(`${first}T00:00:00Z`) } }] },
    orderBy: { date: 'asc' },
  });
  return rows.map(toEntryRow);
}

/** Entradas por origem, mês a mês: agenda (atendimentos concluídos), pedidos retirados e caixa (lançamentos sem agendamento nem pedido). */
async function incomeByMonth(restaurantId: string, from: Date, to: Date) {
  const [agenda, pedidos, caixa, payouts] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT to_char(("completedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${'America/Sao_Paulo'}, 'YYYY-MM') AS month, SUM(GREATEST(0, "priceCents" - "discountCents"))::bigint AS cents, COUNT(*)::bigint AS n
      FROM "Booking" WHERE "restaurantId" = ${restaurantId} AND status = 'COMPLETED' AND "completedAt" >= ${from} AND "completedAt" < ${to} GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT to_char(("pickedUpAt" AT TIME ZONE 'UTC') AT TIME ZONE ${'America/Sao_Paulo'}, 'YYYY-MM') AS month, SUM("totalCents")::bigint AS cents, COUNT(*)::bigint AS n
      FROM "Order" WHERE "restaurantId" = ${restaurantId} AND status = 'PICKED_UP' AND "pickedUpAt" >= ${from} AND "pickedUpAt" < ${to} GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT to_char((c."redeemedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${'America/Sao_Paulo'}, 'YYYY-MM') AS month, SUM(c."amountCents")::bigint AS cents, COUNT(*)::bigint AS n
      FROM "Claim" c LEFT JOIN "Booking" b ON b."claimId" = c.id LEFT JOIN "Order" o ON o."claimId" = c.id
      WHERE c."restaurantId" = ${restaurantId} AND c."redeemedAt" >= ${from} AND c."redeemedAt" < ${to} AND b.id IS NULL AND o.id IS NULL GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT to_char(("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${'America/Sao_Paulo'}, 'YYYY-MM') AS month, SUM("amountCents")::bigint AS cents, COUNT(*)::bigint AS n
      FROM "CommissionPayout" WHERE "restaurantId" = ${restaurantId} AND "paidAt" >= ${from} AND "paidAt" < ${to} GROUP BY 1`,
  ]);
  const by = (rows: Row[]) => new Map(rows.map((r) => [r.month, { cents: num(r.cents), n: num(r.n) }]));
  return { agenda: by(agenda), pedidos: by(pedidos), caixa: by(caixa), payouts: by(payouts) };
}

export type MonthTotal = { month: string; income: number; expense: number };

/** Entradas e saídas dos últimos `n` meses (para o gráfico). */
export async function trend(restaurantId: string, month: string, n = 6): Promise<MonthTotal[]> {
  const months = lastMonths(month, n);
  const { from } = monthRange(months[0]);
  const { to } = monthRange(month);
  const [inc, manual] = await Promise.all([incomeByMonth(restaurantId, from, to), entriesFor(restaurantId, months)]);
  return months.map((m) => {
    const occ = occurrencesIn(manual, m);
    const manualIn = occ.filter((o) => o.kind === 'IN').reduce((s, o) => s + o.amountCents, 0);
    const manualOut = occ.filter((o) => o.kind === 'OUT').reduce((s, o) => s + o.amountCents, 0);
    return {
      month: m,
      income: (inc.agenda.get(m)?.cents ?? 0) + (inc.pedidos.get(m)?.cents ?? 0) + (inc.caixa.get(m)?.cents ?? 0) + manualIn,
      expense: manualOut + (inc.payouts.get(m)?.cents ?? 0),
    };
  });
}

export type CommissionRow = { resourceId: string; name: string; bp: number; services: number; baseCents: number; commissionCents: number; paid: { amountCents: number; paidAt: Date } | null };

export type MonthReport = {
  month: string;
  income: { agenda: { cents: number; n: number }; pedidos: { cents: number; n: number }; caixa: { cents: number; n: number }; manual: number };
  incomeTotal: number;
  expenses: Occurrence[];
  incomes: Occurrence[];
  payoutsCents: number;
  expenseTotal: number;
  byCategory: { category: string; cents: number }[];
  commissions: CommissionRow[];
  commissionsDue: number;
};

/** Relatório do mês: de onde veio o dinheiro, para onde foi, o que sobrou e as comissões de cada profissional. */
export async function monthReport(restaurantId: string, month: string): Promise<MonthReport> {
  const { from, to } = monthRange(month);
  const [inc, manual, resources, byResource, payouts] = await Promise.all([
    incomeByMonth(restaurantId, from, to),
    entriesFor(restaurantId, [month]),
    prisma.resource.findMany({ where: { restaurantId }, select: { id: true, name: true, commissionBp: true, active: true }, orderBy: { name: 'asc' } }),
    prisma.$queryRaw<{ resourceId: string | null; cents: bigint | number | null; n: bigint | number | null }[]>`
      SELECT "resourceId", SUM(GREATEST(0, "priceCents" - "discountCents"))::bigint AS cents, COUNT(*)::bigint AS n
      FROM "Booking" WHERE "restaurantId" = ${restaurantId} AND status = 'COMPLETED' AND "completedAt" >= ${from} AND "completedAt" < ${to} AND "resourceId" IS NOT NULL GROUP BY 1`,
    prisma.commissionPayout.findMany({ where: { restaurantId, month } }),
  ]);
  const occ = occurrencesIn(manual, month);
  const incomes = occ.filter((o) => o.kind === 'IN');
  const expenses = occ.filter((o) => o.kind === 'OUT');
  const manualIn = incomes.reduce((s, o) => s + o.amountCents, 0);
  const payoutsCents = (inc.payouts.get(month)?.cents ?? 0);
  const agenda = inc.agenda.get(month) ?? { cents: 0, n: 0 };
  const pedidos = inc.pedidos.get(month) ?? { cents: 0, n: 0 };
  const caixa = inc.caixa.get(month) ?? { cents: 0, n: 0 };

  const cats = new Map<string, number>();
  for (const e of expenses) cats.set(e.category, (cats.get(e.category) ?? 0) + e.amountCents);
  if (payoutsCents > 0) cats.set('Comissões', (cats.get('Comissões') ?? 0) + payoutsCents);

  const base = new Map(byResource.map((r) => [r.resourceId, { cents: num(r.cents), n: num(r.n) }]));
  const paid = new Map(payouts.map((p) => [p.resourceId, p]));
  const commissions: CommissionRow[] = resources
    .filter((r) => r.commissionBp > 0 || base.has(r.id) || paid.has(r.id))
    .map((r) => {
      const b = base.get(r.id) ?? { cents: 0, n: 0 };
      const p = paid.get(r.id);
      return { resourceId: r.id, name: r.name, bp: p?.commissionBp ?? r.commissionBp, services: b.n, baseCents: p?.baseCents ?? b.cents, commissionCents: p?.amountCents ?? commissionOf(b.cents, r.commissionBp), paid: p ? { amountCents: p.amountCents, paidAt: p.paidAt } : null };
    });

  return {
    month,
    income: { agenda, pedidos, caixa, manual: manualIn },
    incomeTotal: agenda.cents + pedidos.cents + caixa.cents + manualIn,
    incomes, expenses, payoutsCents,
    expenseTotal: expenses.reduce((s, e) => s + e.amountCents, 0) + payoutsCents,
    byCategory: [...cats.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents),
    commissions,
    commissionsDue: commissions.filter((c) => !c.paid).reduce((s, c) => s + c.commissionCents, 0),
  };
}

// ---------- lançamentos manuais ----------
export async function saveEntry(restaurantId: string, id: string | null, raw: Record<string, unknown>) {
  const parsed = parseEntry(raw);
  if (!parsed.ok) throw new BusinessError(parsed.error);
  const v = parsed.value;
  const data = { kind: v.kind, description: v.description, category: v.category, amountCents: v.amountCents, date: new Date(`${v.date}T00:00:00Z`), recurrence: v.recurrence, endsOn: v.endsOn ? new Date(`${v.endsOn}T00:00:00Z`) : null };
  if (id) {
    const done = await prisma.financeEntry.updateMany({ where: { id, restaurantId, source: 'MANUAL' }, data });
    if (done.count !== 1) throw new BusinessError('Lançamento não encontrado.');
    return id;
  }
  return (await prisma.financeEntry.create({ data: { ...data, restaurantId }, select: { id: true } })).id;
}

export async function deleteEntry(restaurantId: string, id: string) {
  await prisma.financeEntry.deleteMany({ where: { id, restaurantId, source: 'MANUAL' } });
}

/** Registra o pagamento da comissão de um profissional num mês (uma vez só por mês). O valor é calculado agora, no servidor. */
export async function payCommission(restaurantId: string, resourceId: string, month: string) {
  const { from, to } = monthRange(month);
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, restaurantId }, select: { id: true, name: true, commissionBp: true } });
  if (!resource) throw new BusinessError('Profissional não encontrado.');
  if (resource.commissionBp <= 0) throw new BusinessError('Cadastre a comissão deste profissional primeiro.');
  const [b] = await prisma.$queryRaw<{ cents: bigint | number | null }[]>`
    SELECT SUM(GREATEST(0, "priceCents" - "discountCents"))::bigint AS cents FROM "Booking"
    WHERE "restaurantId" = ${restaurantId} AND "resourceId" = ${resourceId} AND status = 'COMPLETED' AND "completedAt" >= ${from} AND "completedAt" < ${to}`;
  const baseCents = num(b?.cents);
  const amountCents = commissionOf(baseCents, resource.commissionBp);
  if (amountCents <= 0) throw new BusinessError('Não há comissão a pagar neste mês.');
  try {
    await prisma.commissionPayout.create({ data: { restaurantId, resourceId, resourceName: resource.name, month, baseCents, commissionBp: resource.commissionBp, amountCents } });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw new BusinessError('A comissão deste mês já foi registrada como paga.');
    throw e;
  }
  return amountCents;
}

export async function undoPayout(restaurantId: string, resourceId: string, month: string) {
  await prisma.commissionPayout.deleteMany({ where: { restaurantId, resourceId, month } });
}

/** Encerra um lançamento fixo a partir do mês que o dono está vendo (continua valendo nos meses anteriores). Se ele nem tinha começado antes, apaga. */
export async function endRecurring(restaurantId: string, id: string, month: string) {
  const e = await prisma.financeEntry.findFirst({ where: { id, restaurantId, source: 'MANUAL', recurrence: 'MONTHLY' } });
  if (!e) throw new BusinessError('Lançamento fixo não encontrado.');
  const lastDay = monthBounds(shiftMonth(month, -1)).last;
  if (dateKey(e.date) > lastDay) await prisma.financeEntry.delete({ where: { id } });
  else await prisma.financeEntry.update({ where: { id }, data: { endsOn: new Date(`${lastDay}T00:00:00Z`) } });
}
