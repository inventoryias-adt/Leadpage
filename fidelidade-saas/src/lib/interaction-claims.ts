import 'server-only';
import { prisma } from './db';
import { BusinessError, creditWallet } from './claims';
import { AUTO_APPROVE_HOURS, INTERACTION_COOLDOWN_DAYS, isApproval } from './interaction-approval';
import { notify } from './notifications';
import { allow } from './rate-limit';

/** O cliente toca "Já fiz": cria o pedido de pontos (pendente). Uma interação pendente ou aprovada há pouco não pede de novo. */
export async function requestInteraction(customerId: string, ruleId: string) {
  const rule = await prisma.interactionRule.findFirst({ where: { id: ruleId, active: true }, include: { restaurant: { select: { id: true, subscriptionStatus: true } } } });
  if (!rule || rule.restaurant.subscriptionStatus !== 'ACTIVE') throw new BusinessError('Interação não encontrada.');
  if (!isApproval(rule.approval) || rule.approval === 'COUNTER') throw new BusinessError('Esta interação é confirmada no balcão: mostre ao caixa.');
  if (!(await allow(`ixreq:${customerId}`, 12, 3600))) throw new BusinessError('Muitos pedidos seguidos. Tente de novo mais tarde.');

  const since = new Date(Date.now() - INTERACTION_COOLDOWN_DAYS * 24 * 3_600_000);
  const recent = await prisma.interactionClaim.findFirst({
    where: { customerId, ruleId, OR: [{ status: 'PENDING' }, { status: 'APPROVED', createdAt: { gte: since } }] },
    select: { status: true },
  });
  if (recent?.status === 'PENDING') throw new BusinessError('Seu pedido já está em análise.');
  if (recent) throw new BusinessError(`Você já recebeu os pontos desta interação. Dá para pedir de novo em até ${INTERACTION_COOLDOWN_DAYS} dias.`);

  const autoAt = rule.approval === 'AUTO' ? new Date(Date.now() + AUTO_APPROVE_HOURS * 3_600_000) : null;
  return prisma.interactionClaim.create({ data: { restaurantId: rule.restaurantId, customerId, ruleId: rule.id, label: rule.label, points: rule.points, autoAt } });
}

/** Aprova (credita os pontos) ou recusa um pedido pendente. Só o primeiro vale: duas decisões ao mesmo tempo não creditam duas vezes. */
export async function decideInteraction(id: string, restaurantId: string, approve: boolean, by: 'OWNER' | 'AUTO') {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.interactionClaim.findFirst({ where: { id, restaurantId } });
    if (!claim) throw new BusinessError('Pedido não encontrado.');
    const marked = await tx.interactionClaim.updateMany({
      where: { id, restaurantId, status: 'PENDING' },
      data: { status: approve ? 'APPROVED' : 'REJECTED', decidedAt: new Date(), decidedBy: by },
    });
    if (marked.count !== 1) return { decided: false as const, claim };
    if (approve) await creditWallet(tx, claim.customerId, restaurantId, claim.points, claim.label);
    else {
      await notify(tx, {
        customerId: claim.customerId,
        restaurantId,
        title: 'Não conseguimos confirmar',
        body: `${claim.label}: o lugar não confirmou este pedido de pontos. Fale com o caixa se achar que foi engano.`,
        href: `/lugar/${restaurantId}`,
      });
    }
    return { decided: true as const, claim };
  });
}

/** Pedidos em modo automático cujo prazo de recusa acabou: os pontos entram. Roda no cron e também ao abrir as telas. */
export async function settleDueInteractions(where: { restaurantId?: string; customerId?: string } = {}) {
  const due = await prisma.interactionClaim.findMany({ where: { ...where, status: 'PENDING', autoAt: { lte: new Date() } }, select: { id: true, restaurantId: true }, take: 200 });
  let credited = 0;
  for (const c of due) {
    try {
      if ((await decideInteraction(c.id, c.restaurantId, true, 'AUTO')).decided) credited += 1;
    } catch (e) {
      console.error('[interacoes/auto]', e);
    }
  }
  return credited;
}
