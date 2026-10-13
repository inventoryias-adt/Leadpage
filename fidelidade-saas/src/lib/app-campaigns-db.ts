import 'server-only';
import { Prisma } from '@prisma/client';
import { BusinessError } from './claims';
import { canAdopt, promotionFields } from './app-campaigns';
import { prisma } from './db';

const MAX_PROMOTIONS = 20;

/** O estabelecimento adota a campanha: ganha uma promoção ligada a ela (vale no caixa e vira card na vitrine). */
export async function joinCampaign(restaurantId: string, campaignId: string) {
  const campaign = await prisma.appCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !canAdopt(campaign)) throw new BusinessError('Esta campanha não está mais disponível.');
  const exists = await prisma.promotion.findFirst({ where: { restaurantId, appCampaignId: campaignId }, select: { id: true } });
  if (exists) return;
  if ((await prisma.promotion.count({ where: { restaurantId } })) >= MAX_PROMOTIONS) throw new BusinessError('Limite de 20 campanhas atingido. Remova alguma antiga.');
  try {
    await prisma.promotion.create({ data: { restaurantId, appCampaignId: campaignId, ...promotionFields(campaign) } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e; // dois toques ao mesmo tempo: já adotou
  }
}

/** Deixa de participar: a promoção some do caixa e da vitrine. */
export async function leaveCampaign(restaurantId: string, campaignId: string) {
  await prisma.promotion.deleteMany({ where: { restaurantId, appCampaignId: campaignId } });
}

/**
 * Depois que o administrador edita a campanha, as promoções dos estabelecimentos acompanham (texto, dias, horário…).
 * `active` só é mexido quando a campanha liga ou desliga, para não reativar o que o dono pausou.
 */
export async function syncCampaign(campaignId: string, opts: { activeChanged?: boolean } = {}) {
  const c = await prisma.appCampaign.findUnique({ where: { id: campaignId } });
  if (!c) return;
  const { active, ...fields } = promotionFields(c);
  await prisma.promotion.updateMany({ where: { appCampaignId: campaignId }, data: opts.activeChanged ? { ...fields, active } : fields });
}

/** Campanhas que o cliente vê: ativas, dentro do prazo e já adotadas por ao menos um lugar da vitrine. */
export async function campaignsForCustomers(now: Date = new Date()) {
  const rows = await prisma.appCampaign.findMany({
    where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    orderBy: { createdAt: 'desc' },
    include: {
      promotions: {
        where: { active: true, restaurant: { subscriptionStatus: 'ACTIVE', onboardedAt: { not: null }, listed: true } },
        select: { restaurantId: true },
      },
    },
  });
  return rows.filter((c) => c.promotions.length > 0).map(({ promotions, ...c }) => ({ ...c, places: promotions.length }));
}
