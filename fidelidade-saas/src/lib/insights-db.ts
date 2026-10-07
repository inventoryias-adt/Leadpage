import 'server-only';
import { prisma } from './db';
import { segmentsOf, type Segment } from './insights';

export type CustomerRow = {
  customerId: string;
  walletId: string;
  name: string;
  phone: string;
  balance: number;
  createdAt: Date;
  purchases: number;
  lastPurchaseAt: Date | null;
  segments: Segment[];
};

/** Carteiras do estabelecimento com compras, última compra e segmentos (novos, fiéis, quase lá, sumidos). */
export async function loadCustomerRows(restaurantId: string, now: Date = new Date()) {
  const [cheapest, wallets, stats] = await Promise.all([
    prisma.reward.findFirst({ where: { restaurantId, active: true }, orderBy: { pointsCost: 'asc' }, select: { pointsCost: true } }),
    prisma.wallet.findMany({
      where: { restaurantId },
      select: { id: true, customerId: true, balance: true, createdAt: true, customer: { select: { name: true, phone: true } } },
      take: 5000,
    }),
    prisma.claim.groupBy({
      by: ['customerId'],
      where: { restaurantId, redeemedAt: { not: null }, amountCents: { gt: 0 }, customerId: { not: null } },
      _count: true,
      _max: { redeemedAt: true },
    }),
  ]);
  const minReward = cheapest?.pointsCost ?? null;
  const byCustomer = new Map(stats.map((s) => [s.customerId, s]));
  const rows: CustomerRow[] = wallets.map((w) => {
    const s = byCustomer.get(w.customerId);
    const facts = { createdAt: w.createdAt, purchases: s?._count ?? 0, lastPurchaseAt: s?._max.redeemedAt ?? null, balance: w.balance, minReward };
    return {
      customerId: w.customerId,
      walletId: w.id,
      name: w.customer.name,
      phone: w.customer.phone,
      balance: w.balance,
      createdAt: w.createdAt,
      purchases: facts.purchases,
      lastPurchaseAt: facts.lastPurchaseAt,
      segments: segmentsOf(facts, now),
    };
  });
  return { rows, minReward };
}
