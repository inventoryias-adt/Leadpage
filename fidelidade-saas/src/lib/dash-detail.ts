import 'server-only';
import { dayStartUtc, parseDateKey } from './booking';
import { prisma } from './db';
import { brtParts, WEEKDAYS, type DayDetail, type SlotDetail } from './insights';

const DAY = 24 * 60 * 60 * 1000;
const SLOT_DAYS = 90;

const hm = (d: Date) => {
  const l = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return `${String(l.getUTCHours()).padStart(2, '0')}:${String(l.getUTCMinutes()).padStart(2, '0')}`;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STATUS: Record<string, string> = { PENDING: 'a entregar', USED: 'entregue', EXPIRED: 'sem validade' };

/** O que aconteceu em um dia (Brasília) no estabelecimento: compras, resgates, campanhas, desafios, clientes novos. */
export async function dayDetail(restaurantId: string, ymd: string): Promise<DayDetail | null> {
  if (!parseDateKey(ymd)) return null;
  const start = dayStartUtc(ymd);
  const end = new Date(start.getTime() + DAY);
  const prevStart = new Date(start.getTime() - 7 * DAY);
  const prevEnd = new Date(prevStart.getTime() + DAY);
  const inDay = { gte: start, lt: end };

  const [claims, prev, redemptions, newWallets, promoUses, completions, interactions, gifts] = await Promise.all([
    prisma.claim.findMany({
      where: { restaurantId, redeemedAt: inDay, amountCents: { gt: 0 } },
      select: { redeemedAt: true, amountCents: true, points: true, description: true, customer: { select: { name: true } } },
      orderBy: { redeemedAt: 'asc' },
      take: 500,
    }),
    prisma.claim.aggregate({ where: { restaurantId, redeemedAt: { gte: prevStart, lt: prevEnd }, amountCents: { gt: 0 } }, _count: true, _sum: { amountCents: true } }),
    prisma.redemption.findMany({ where: { restaurantId, createdAt: inDay }, select: { rewardName: true, status: true, customer: { select: { name: true } } }, orderBy: { createdAt: 'asc' }, take: 100 }),
    prisma.wallet.count({ where: { restaurantId, createdAt: inDay } }),
    prisma.promotionUse.groupBy({ by: ['title'], where: { restaurantId, createdAt: inDay }, _count: true, _sum: { points: true } }),
    prisma.challengeCompletion.groupBy({ by: ['challengeId'], where: { challenge: { restaurantId }, createdAt: inDay }, _count: true }),
    prisma.interactionClaim.count({ where: { restaurantId, status: 'APPROVED', decidedAt: inDay } }),
    prisma.birthdayGift.count({ where: { restaurantId, createdAt: inDay } }),
  ]);
  const challengeNames = completions.length ? await prisma.challenge.findMany({ where: { id: { in: completions.map((c) => c.challengeId) } }, select: { id: true, title: true } }) : [];
  const nameOf = new Map(challengeNames.map((c) => [c.id, c.title]));

  const cents = claims.reduce((n, c) => n + c.amountCents, 0);
  const wd = WEEKDAYS[brtParts(new Date(start.getTime() + 12 * 60 * 60 * 1000)).dow];
  return {
    ymd,
    title: `${cap(wd)}, ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`,
    count: claims.length,
    cents,
    points: claims.reduce((n, c) => n + c.points, 0),
    ticketCents: claims.length ? Math.round(cents / claims.length) : 0,
    prevWeek: { count: prev._count, cents: prev._sum.amountCents ?? 0 },
    purchases: claims.map((c) => ({ time: hm(c.redeemedAt as Date), who: c.customer?.name ?? 'Cliente', cents: c.amountCents, points: c.points, what: c.description })),
    redemptions: redemptions.map((r) => ({ who: r.customer.name, what: r.rewardName, status: STATUS[r.status] ?? r.status.toLowerCase() })),
    promos: promoUses.map((p) => ({ title: p.title, uses: p._count, points: p._sum.points ?? 0 })).sort((a, b) => b.uses - a.uses),
    challenges: completions.map((c) => ({ title: nameOf.get(c.challengeId) ?? 'Desafio', count: c._count })).sort((a, b) => b.count - a.count),
    newCustomers: newWallets,
    interactions,
    birthdayGifts: gifts,
  };
}

/** Um horário do mapa de calor: dia da semana + hora nos últimos 90 dias (quando, quem e que campanha). */
export async function slotDetail(restaurantId: string, dow: number, hour: number, now: Date = new Date()): Promise<{ slot: SlotDetail; best: number } | null> {
  if (!Number.isInteger(dow) || dow < 0 || dow > 6 || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const rows = await prisma.claim.findMany({
    where: { restaurantId, redeemedAt: { gte: new Date(now.getTime() - SLOT_DAYS * DAY) }, amountCents: { gt: 0 } },
    select: { id: true, redeemedAt: true, amountCents: true, customer: { select: { name: true } } },
    take: 40000,
  });
  const counts = new Map<string, number>();
  const mine = rows.filter((r) => {
    const p = brtParts(r.redeemedAt as Date);
    const key = `${p.dow}-${p.hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return p.dow === dow && p.hour === hour;
  });
  const best = Math.max(0, ...counts.values());
  const byDay = new Map<string, number>();
  const byClient = new Map<string, number>();
  for (const r of mine) {
    const ymd = brtParts(r.redeemedAt as Date).ymd;
    byDay.set(ymd, (byDay.get(ymd) ?? 0) + 1);
    const who = r.customer?.name ?? 'Cliente';
    byClient.set(who, (byClient.get(who) ?? 0) + 1);
  }
  const uses = mine.length ? await prisma.promotionUse.groupBy({ by: ['title'], where: { restaurantId, claimId: { in: mine.map((m) => m.id) } }, _count: true }) : [];
  const cents = mine.reduce((n, r) => n + r.amountCents, 0);
  return {
    best,
    slot: {
      dow,
      hour,
      count: mine.length,
      cents,
      ticketCents: mine.length ? Math.round(cents / mine.length) : 0,
      weeks: byDay.size,
      totalWeeks: Math.round(SLOT_DAYS / 7),
      recent: [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6).map(([ymd, count]) => ({ ymd, label: `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`, count })),
      topClients: [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([who, count]) => ({ who, count })),
      promos: uses.map((u) => ({ title: u.title, uses: u._count })).sort((a, b) => b.uses - a.uses),
    },
  };
}
