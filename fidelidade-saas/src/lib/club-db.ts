import 'server-only';
import type { Prisma } from '@prisma/client';
import { dateKeyOf, dayStartUtc, todayKey } from './booking';
import { isValidCpf, onlyDigits } from './br';
import { BusinessError } from './claims';
import { balances, canRegisterPayment, coveredUntil, coveringPeriod, parsePlan, periodIndex, periodRange, subscriptionState, type Balance, type SubState } from './club';
import { prisma } from './db';
import { notify } from './notifications';
import { formatBRL } from './points';

type Db = Prisma.TransactionClient | typeof prisma;
/** Agendamentos que ocupam o saldo do ciclo: só o cancelado devolve. */
const COUNTS = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] as const;
const dayKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null); // colunas DATE vêm como meia-noite UTC

const planInclude = { items: { include: { service: { select: { name: true, priceCents: true } } }, orderBy: { service: { name: 'asc' } } } } satisfies Prisma.ClubPlanInclude;
export type PlanView = { id: string; name: string; description: string | null; priceCents: number; active: boolean; items: { serviceId: string; name: string; priceCents: number; quantity: number }[] };
const toPlan = (p: Prisma.ClubPlanGetPayload<{ include: typeof planInclude }>): PlanView => ({
  id: p.id, name: p.name, description: p.description, priceCents: p.priceCents, active: p.active,
  items: p.items.map((i) => ({ serviceId: i.serviceId, name: i.service.name, priceCents: i.service.priceCents, quantity: i.quantity })),
});

export async function activePlans(restaurantId: string): Promise<PlanView[]> {
  return (await prisma.clubPlan.findMany({ where: { restaurantId, active: true }, include: planInclude, orderBy: { priceCents: 'asc' } })).map(toPlan);
}
export async function allPlans(restaurantId: string): Promise<(PlanView & { subscribers: number })[]> {
  const rows = await prisma.clubPlan.findMany({ where: { restaurantId }, include: { ...planInclude, _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } } }, orderBy: [{ active: 'desc' }, { priceCents: 'asc' }] });
  return rows.map((p) => ({ ...toPlan(p), subscribers: p._count.subscriptions }));
}

/** Cria ou atualiza um plano. Os serviços precisam ser do lugar. Mudar os itens vale a partir do ciclo seguinte de quem já assina. */
export async function savePlan(restaurantId: string, id: string | null, raw: Parameters<typeof parsePlan>[0]) {
  const parsed = parsePlan(raw);
  if (!parsed.ok) throw new BusinessError(parsed.error);
  const v = parsed.value;
  const services = await prisma.service.findMany({ where: { restaurantId, id: { in: v.items.map((i) => i.serviceId) }, active: true }, select: { id: true } });
  if (services.length !== v.items.length) throw new BusinessError('Um dos serviços escolhidos não existe mais. Atualize a página.');
  if (id) {
    const own = await prisma.clubPlan.findFirst({ where: { id, restaurantId }, select: { id: true } });
    if (!own) throw new BusinessError('Plano não encontrado.');
    await prisma.$transaction([
      prisma.clubPlan.update({ where: { id }, data: { name: v.name, description: v.description, priceCents: v.priceCents } }),
      prisma.clubPlanItem.deleteMany({ where: { planId: id } }),
      prisma.clubPlanItem.createMany({ data: v.items.map((i) => ({ planId: id, serviceId: i.serviceId, quantity: i.quantity })) }),
    ]);
    return id;
  }
  return (await prisma.clubPlan.create({ data: { restaurantId, name: v.name, description: v.description, priceCents: v.priceCents, items: { create: v.items } }, select: { id: true } })).id;
}

export async function setPlanActive(restaurantId: string, id: string, active: boolean) {
  await prisma.clubPlan.updateMany({ where: { id, restaurantId }, data: { active } });
}

// ---------- assinaturas ----------
async function newSubscription(db: Db, args: { restaurantId: string; planId: string; customerId: string; by: 'CUSTOMER' | 'OWNER' }) {
  const plan = await db.clubPlan.findFirst({ where: { id: args.planId, restaurantId: args.restaurantId, active: true }, select: { id: true, name: true, priceCents: true, restaurant: { select: { subscriptionStatus: true, onboardedAt: true } } } });
  if (!plan || plan.restaurant.subscriptionStatus !== 'ACTIVE' || !plan.restaurant.onboardedAt) throw new BusinessError('Este plano não está disponível.');
  const dup = await db.clubSubscription.findFirst({ where: { customerId: args.customerId, planId: plan.id, status: 'ACTIVE' }, select: { id: true } });
  if (dup) throw new BusinessError('Você já assina este plano.');
  return db.clubSubscription.create({ data: { restaurantId: args.restaurantId, planId: plan.id, customerId: args.customerId, planName: plan.name, priceCents: plan.priceCents, requestedBy: args.by }, select: { id: true, planName: true } });
}

/** O cliente pede a assinatura pelo app; vale a partir do primeiro pagamento, que o lugar registra no balcão. */
export async function requestSubscription(customerId: string, planId: string) {
  const plan = await prisma.clubPlan.findUnique({ where: { id: planId }, select: { restaurantId: true, restaurant: { select: { name: true } } } });
  if (!plan) throw new BusinessError('Este plano não está disponível.');
  const sub = await newSubscription(prisma, { restaurantId: plan.restaurantId, planId, customerId, by: 'CUSTOMER' });
  await notify(prisma, { customerId, restaurantId: plan.restaurantId, title: 'Assinatura pedida', body: `${sub.planName} · ${plan.restaurant.name}. Faça o primeiro pagamento no balcão para começar a usar.`, href: '/perfil/clube' });
  return sub.id;
}

/** O lugar cadastra um assinante pelo CPF (e já registra o primeiro pagamento, se o dinheiro foi recebido). */
export async function addSubscriber(restaurantId: string, args: { cpf: string; planId: string; paid: boolean }) {
  const cpf = onlyDigits(args.cpf);
  if (!isValidCpf(cpf)) throw new BusinessError('CPF inválido.');
  const customer = await prisma.customer.findUnique({ where: { cpf }, select: { id: true } });
  if (!customer) throw new BusinessError('Não há cliente com esse CPF no app. Peça para ele criar a conta no Fidelize.');
  const sub = await newSubscription(prisma, { restaurantId, planId: args.planId, customerId: customer.id, by: 'OWNER' });
  if (args.paid) await registerPayment(restaurantId, sub.id);
  else await notify(prisma, { customerId: customer.id, restaurantId, title: 'Você foi adicionado a um plano', body: `${sub.planName}. O primeiro pagamento é feito no balcão.`, href: '/perfil/clube' });
  return sub.id;
}

/**
 * Registra o pagamento de mais um mês: cobre mais um ciclo e entra como entrada no financeiro (uma vez por ciclo). O primeiro pagamento
 * define o início do ciclo (hoje). Só dá para antecipar um ciclo.
 */
export async function registerPayment(restaurantId: string, id: string, today: string = todayKey()) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ClubSubscription" WHERE id = ${id} FOR UPDATE`;
    const sub = await tx.clubSubscription.findFirst({ where: { id, restaurantId }, include: { customer: { select: { id: true, name: true } } } });
    if (!sub) throw new BusinessError('Assinatura não encontrada.');
    if (sub.status !== 'ACTIVE') throw new BusinessError('Esta assinatura foi cancelada.');
    const anchor = dayKey(sub.anchorDate) ?? today;
    if (!canRegisterPayment({ anchorDate: dayKey(sub.anchorDate), paidPeriods: sub.paidPeriods }, today)) throw new BusinessError(`Já está pago até ${coveredUntil(anchor, sub.paidPeriods)!.split('-').reverse().join('/')}. A renovação abre na última semana do ciclo.`);
    const n = sub.paidPeriods + 1;
    await tx.clubSubscription.update({ where: { id }, data: { paidPeriods: n, anchorDate: sub.anchorDate ?? new Date(`${today}T00:00:00Z`) } });
    await tx.financeEntry.create({ data: { restaurantId, kind: 'IN', description: `Clube: ${sub.planName} · ${sub.customer.name}`.slice(0, 80), category: 'Clube de assinatura', amountCents: sub.priceCents, date: new Date(`${today}T00:00:00Z`), source: 'CLUBE', refId: `club:${id}:${n}` } });
    const until = coveredUntil(anchor, n)!.split('-').reverse().join('/');
    await notify(tx, { customerId: sub.customerId, restaurantId, title: n === 1 ? 'Plano ativo' : 'Plano renovado', body: `${sub.planName}: pagamento de ${formatBRL(sub.priceCents)} recebido. Vale até ${until}.`, href: '/perfil/clube' });
  });
}

/** Desfaz o último pagamento registrado por engano, se nenhum atendimento do plano já usou aquele ciclo. */
export async function undoPayment(restaurantId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ClubSubscription" WHERE id = ${id} FOR UPDATE`;
    const sub = await tx.clubSubscription.findFirst({ where: { id, restaurantId } });
    if (!sub || sub.paidPeriods <= 0 || !sub.anchorDate) throw new BusinessError('Não há pagamento para desfazer.');
    const r = periodRange(dayKey(sub.anchorDate)!, sub.paidPeriods - 1);
    const used = await tx.booking.count({ where: { clubSubscriptionId: id, status: { in: [...COUNTS] }, startsAt: { gte: dayStartUtc(r.start), lt: dayStartUtc(r.end) } } });
    if (used > 0) throw new BusinessError('Esse ciclo já tem atendimentos do plano. Não dá para desfazer o pagamento.');
    await tx.financeEntry.deleteMany({ where: { restaurantId, refId: `club:${id}:${sub.paidPeriods}` } });
    await tx.clubSubscription.update({ where: { id }, data: { paidPeriods: sub.paidPeriods - 1, ...(sub.paidPeriods === 1 ? { anchorDate: null } : {}) } });
  });
}

/** Cancela a renovação (pelo cliente ou pelo lugar). O que já foi pago continua valendo até o fim do ciclo. */
export async function cancelSubscription(id: string, by: { customerId?: string; restaurantId?: string }) {
  const done = await prisma.clubSubscription.updateMany({ where: { id, status: 'ACTIVE', ...(by.customerId ? { customerId: by.customerId } : {}), ...(by.restaurantId ? { restaurantId: by.restaurantId } : {}) }, data: { status: 'CANCELED', canceledAt: new Date() } });
  if (done.count !== 1) throw new BusinessError('Assinatura não encontrada.');
}

// ---------- saldo e cobertura ----------
async function usedByService(db: Db, subId: string, range: { start: string; end: string }) {
  const rows = await db.booking.groupBy({ by: ['serviceId'], where: { clubSubscriptionId: subId, status: { in: [...COUNTS] }, startsAt: { gte: dayStartUtc(range.start), lt: dayStartUtc(range.end) } }, _count: { _all: true } });
  return new Map(rows.filter((r) => r.serviceId).map((r) => [r.serviceId as string, r._count._all]));
}

/**
 * O atendimento marcado para `at` é coberto por algum plano pago deste cliente neste lugar, e ainda há saldo no ciclo daquela data?
 * Roda dentro da transação do agendamento (que já tem o cadeado do estabelecimento), então dois pedidos não gastam o mesmo saldo.
 */
export async function clubCoverage(db: Db, args: { restaurantId: string; customerId: string; serviceId: string; at: Date }) {
  const day = dateKeyOf(args.at);
  const subs = await db.clubSubscription.findMany({
    where: { restaurantId: args.restaurantId, customerId: args.customerId, paidPeriods: { gt: 0 }, anchorDate: { not: null }, plan: { items: { some: { serviceId: args.serviceId } } } },
    include: { plan: { include: { items: { where: { serviceId: args.serviceId } } } } },
    orderBy: { createdAt: 'asc' },
  });
  for (const s of subs) {
    const k = coveringPeriod({ anchorDate: dayKey(s.anchorDate), paidPeriods: s.paidPeriods }, day);
    if (k == null) continue;
    const range = periodRange(dayKey(s.anchorDate)!, k);
    const used = (await usedByService(db, s.id, range)).get(args.serviceId) ?? 0;
    const quantity = s.plan.items[0].quantity;
    if (used < quantity) return { subscriptionId: s.id, planName: s.planName, left: quantity - used - 1, period: k, range };
  }
  return null;
}

/** Quantos usos o ciclo de `subId` que contém `at` já gastou do serviço (para conferir remarcação dentro do mesmo ciclo). */
export async function periodOf(db: Db, subId: string, at: Date): Promise<number | null> {
  const s = await db.clubSubscription.findUnique({ where: { id: subId }, select: { anchorDate: true, paidPeriods: true } });
  if (!s) return null;
  return coveringPeriod({ anchorDate: dayKey(s.anchorDate), paidPeriods: s.paidPeriods }, dateKeyOf(at));
}

// ---------- listas para as telas ----------
export type SubView = {
  id: string; planId: string; planName: string; priceCents: number; status: string; state: SubState; requestedBy: string; createdAt: Date;
  paidPeriods: number; coveredUntil: string | null; cycle: { start: string; end: string } | null; balances: Balance[]; canPay: boolean;
};

async function viewOf(sub: Prisma.ClubSubscriptionGetPayload<{ include: { plan: { include: { items: { include: { service: { select: { name: true } } } } } } } }>, today: string): Promise<SubView> {
  const anchor = dayKey(sub.anchorDate);
  const state = subscriptionState({ status: sub.status, anchorDate: anchor, paidPeriods: sub.paidPeriods }, today);
  const k = anchor ? periodIndex(anchor, today) : -1;
  // Mostra o ciclo de hoje; se ele já passou do que foi pago, mostra o último pago.
  const shown = anchor && sub.paidPeriods > 0 ? Math.min(Math.max(k, 0), sub.paidPeriods - 1) : null;
  const cycle = anchor && shown != null ? periodRange(anchor, shown) : null;
  const used = cycle ? await usedByService(prisma, sub.id, cycle) : new Map<string, number>();
  return {
    id: sub.id, planId: sub.planId, planName: sub.planName, priceCents: sub.priceCents, status: sub.status, state, requestedBy: sub.requestedBy, createdAt: sub.createdAt,
    paidPeriods: sub.paidPeriods, coveredUntil: coveredUntil(anchor, sub.paidPeriods), cycle,
    balances: balances(sub.plan.items.map((i) => ({ serviceId: i.serviceId, name: i.service.name, quantity: i.quantity })), used),
    canPay: sub.status === 'ACTIVE' && canRegisterPayment({ anchorDate: anchor, paidPeriods: sub.paidPeriods }, today),
  };
}
const subInclude = { plan: { include: { items: { include: { service: { select: { name: true } } }, orderBy: { service: { name: 'asc' as const } } } } } };

export async function subscriptionsOfCustomer(customerId: string, today: string = todayKey()) {
  const rows = await prisma.clubSubscription.findMany({ where: { customerId }, include: { ...subInclude, restaurant: { select: { id: true, name: true, logoImageId: true } } }, orderBy: { createdAt: 'desc' } });
  const views = await Promise.all(rows.map((r) => viewOf(r, today)));
  return views.map((v, i) => ({ ...v, restaurant: rows[i].restaurant }));
}

export async function subscriptionsOfRestaurant(restaurantId: string, today: string = todayKey()) {
  const rows = await prisma.clubSubscription.findMany({ where: { restaurantId, OR: [{ status: 'ACTIVE' }, { paidPeriods: { gt: 0 } }] }, include: { ...subInclude, customer: { select: { id: true, name: true, phone: true } } }, orderBy: { createdAt: 'desc' }, take: 300 });
  const views = await Promise.all(rows.map((r) => viewOf(r, today)));
  return views.map((v, i) => ({ ...v, customer: rows[i].customer }));
}

/** Quantos assinantes aguardam o primeiro pagamento ou estão com o ciclo vencido (bolinha do menu). */
export async function pendingSubscribers(restaurantId: string, today: string = todayKey()) {
  const rows = await prisma.clubSubscription.findMany({ where: { restaurantId, status: 'ACTIVE' }, select: { status: true, anchorDate: true, paidPeriods: true } });
  return rows.filter((r) => { const s = subscriptionState({ status: r.status, anchorDate: dayKey(r.anchorDate), paidPeriods: r.paidPeriods }, today); return s === 'AWAITING' || s === 'DUE'; }).length;
}
