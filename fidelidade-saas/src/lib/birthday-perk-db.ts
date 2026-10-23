import 'server-only';
import { prisma } from './db';
import { dayStartUtc, todayKey } from './booking';
import { BusinessError, redeemItems } from './claims';
import { isBirthdayToday, perkRewardName, type PerkConfig } from './birthday-perk';

const yearStart = (now: Date = new Date()) => dayStartUtc(`${todayKey(now).slice(0, 4)}-01-01`);

/**
 * O dono salva o presente do aniversariante. Por baixo, o presente é um prêmio escondido (`birthdayOnly`) do próprio lugar:
 * assim o cliente recebe um cupom comum, que o balcão valida em Resgates como qualquer prêmio.
 */
export async function saveBirthdayPerk(restaurantId: string, cfg: PerkConfig) {
  await prisma.$transaction(async (tx) => {
    await tx.restaurant.update({
      where: { id: restaurantId },
      data: { birthdayPerkOn: cfg.on, birthdayPerkTitle: cfg.title || null, birthdayPerkMode: cfg.mode, birthdayPerkPoints: cfg.points, birthdayPerkMinCents: cfg.minCents },
    });
    const existing = await tx.reward.findFirst({ where: { restaurantId, birthdayOnly: true }, select: { id: true } });
    const data = { name: perkRewardName(cfg), description: 'Presente de aniversário', pointsCost: cfg.mode === 'POINTS' ? cfg.points : 0, cashCents: 0, active: cfg.on };
    if (existing) await tx.reward.update({ where: { id: existing.id }, data });
    else if (cfg.on) await tx.reward.create({ data: { ...data, restaurantId, birthdayOnly: true } });
  });
}

/** Lugares que dão presente de aniversário e aparecem na vitrine (ativos, configurados e listados). */
export function perkPlaces() {
  return prisma.restaurant.findMany({
    where: { subscriptionStatus: 'ACTIVE', onboardedAt: { not: null }, listed: true, birthdayPerkOn: true, birthdayPerkTitle: { not: null } },
    select: { id: true, name: true, logoImageId: true, birthdayPerkTitle: true, birthdayPerkMode: true, birthdayPerkPoints: true, birthdayPerkMinCents: true },
    orderBy: { name: 'asc' },
    take: 200,
  });
}

/** Cupom de aniversário que o cliente já pegou neste lugar este ano (se houver). */
export function perkRedemptionThisYear(customerId: string, restaurantId: string) {
  return prisma.redemption.findFirst({
    where: { customerId, restaurantId, reward: { birthdayOnly: true }, createdAt: { gte: yearStart() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, code: true, status: true, rewardName: true },
  });
}

/** O cliente pega o presente do aniversário (só no dia, um por lugar a cada ano). Devolve o cupom gerado. */
export async function claimBirthdayPerk(customerId: string, restaurantId: string) {
  const [customer, restaurant] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { birthDay: true, birthMonth: true } }),
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { subscriptionStatus: true, birthdayPerkOn: true, birthdayPerkTitle: true } }),
  ]);
  if (!customer || !isBirthdayToday(customer)) throw new BusinessError('O presente vale só no dia do seu aniversário.');
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.birthdayPerkOn || !restaurant.birthdayPerkTitle) throw new BusinessError('Este lugar não oferece presente de aniversário agora.');
  const reward = await prisma.reward.findFirst({ where: { restaurantId, birthdayOnly: true, active: true }, select: { id: true } });
  if (!reward) throw new BusinessError('Este lugar não oferece presente de aniversário agora.');
  const [redemption] = await redeemItems(customerId, restaurantId, [{ rewardId: reward.id, qty: 1 }], { birthday: { since: yearStart() } });
  return redemption;
}
