import 'server-only';
import { prisma } from './db';

/** Prêmios que o cliente já pode trocar com o saldo atual de cada carteira (lugares ativos), do mais caro para o mais barato. */
export async function affordableRewards(customerId: string, opts: { perPlace?: number; limit?: number } = {}) {
  const wallets = await prisma.wallet.findMany({
    where: { customerId, balance: { gt: 0 }, restaurant: { subscriptionStatus: 'ACTIVE' } },
    select: { balance: true, restaurant: { select: { id: true, name: true } } },
    orderBy: { balance: 'desc' },
  });
  const lists = await Promise.all(
    wallets.map(async (w) => {
      const rewards = await prisma.reward.findMany({
        where: { restaurantId: w.restaurant.id, active: true, pointsCost: { lte: w.balance } },
        orderBy: { pointsCost: 'desc' },
        take: opts.perPlace ?? 4,
      });
      return rewards.map((r) => ({ ...r, place: w.restaurant }));
    }),
  );
  const all = lists.flat();
  return opts.limit ? all.slice(0, opts.limit) : all;
}

/** Vouchers gerados e ainda não entregues no balcão. */
export const pendingVouchers = (customerId: string, take?: number) =>
  prisma.redemption.findMany({
    where: { customerId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take,
    include: { restaurant: { select: { id: true, name: true } } },
  });

/** Prêmios já entregues (histórico de resgates). */
export const usedRedemptions = (customerId: string, take = 100) =>
  prisma.redemption.findMany({
    where: { customerId, status: 'USED' },
    orderBy: [{ usedAt: 'desc' }, { createdAt: 'desc' }],
    take,
    include: { restaurant: { select: { id: true, name: true } }, usedUnit: { select: { name: true } } },
  });

/** O prêmio mais próximo de ser alcançado (menor diferença de pontos) entre as carteiras do cliente. */
export async function nextReward(customerId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { customerId, restaurant: { subscriptionStatus: 'ACTIVE' } },
    select: { balance: true, restaurant: { select: { id: true, name: true } } },
  });
  const found = await Promise.all(
    wallets.map(async (w) => {
      const reward = await prisma.reward.findFirst({
        where: { restaurantId: w.restaurant.id, active: true, pointsCost: { gt: w.balance } },
        orderBy: { pointsCost: 'asc' },
        select: { name: true, pointsCost: true },
      });
      return reward ? { reward, place: w.restaurant, missing: reward.pointsCost - w.balance } : null;
    }),
  );
  return found.filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => a.missing - b.missing)[0] ?? null;
}
