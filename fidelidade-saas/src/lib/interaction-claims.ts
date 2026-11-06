import 'server-only';
import { prisma } from './db';
import { BusinessError, creditWallet } from './claims';
import { AUTO_APPROVE_HOURS, INTERACTION_COOLDOWN_DAYS, isApproval } from './interaction-approval';
import { notify } from './notifications';
import { allow } from './rate-limit';
import { actionKind } from './interaction-kind';
import { listReviews, googleConfigured } from './google-reviews';
import { CLOCK_SLACK_MS, matchClaims, type PendingClaim } from './google-match';

/** O cliente toca "Já fiz": cria o pedido de pontos (pendente). Uma interação pendente ou aprovada há pouco não pede de novo. */
export async function requestInteraction(customerId: string, ruleId: string, extra: { openedAt?: Date; unitId?: string | null } = {}) {
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
  return prisma.interactionClaim.create({ data: { restaurantId: rule.restaurantId, customerId, ruleId: rule.id, label: rule.label, points: rule.points, autoAt, openedAt: extra.openedAt ?? null, unitId: extra.unitId ?? null } });
}

/** Aprova (credita os pontos) ou recusa um pedido pendente. Só o primeiro vale: duas decisões ao mesmo tempo não creditam duas vezes. */
export async function decideInteraction(id: string, restaurantId: string, approve: boolean, by: 'OWNER' | 'AUTO' | 'GOOGLE', extra: { googleReviewId?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.interactionClaim.findFirst({ where: { id, restaurantId } });
    if (!claim) throw new BusinessError('Pedido não encontrado.');
    const marked = await tx.interactionClaim.updateMany({
      where: { id, restaurantId, status: 'PENDING' },
      data: { status: approve ? 'APPROVED' : 'REJECTED', decidedAt: new Date(), decidedBy: by, ...(extra.googleReviewId ? { googleReviewId: extra.googleReviewId } : {}) },
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

// ───────────────────────── Avaliação no Google: abrir, confirmar e conferir ─────────────────────────

/** O cliente tocou em "Avaliar no Google": guarda a hora (só vale avaliação escrita depois dela). */
export async function startGoogleReview(customerId: string, ruleId: string, unitId?: string | null) {
  const rule = await prisma.interactionRule.findFirst({ where: { id: ruleId, active: true }, include: { restaurant: { select: { subscriptionStatus: true } } } });
  if (!rule || rule.restaurant.subscriptionStatus !== 'ACTIVE' || actionKind(rule.label) !== 'google') throw new BusinessError('Interação não encontrada.');
  if (!(await allow(`gstart:${customerId}`, 30, 3600))) throw new BusinessError('Muitas tentativas seguidas. Tente de novo mais tarde.');
  const unit = unitId ? await prisma.unit.findFirst({ where: { id: unitId, restaurantId: rule.restaurantId }, select: { id: true } }) : null;
  const now = new Date();
  await prisma.googleReviewIntent.upsert({
    where: { customerId_ruleId: { customerId, ruleId } },
    create: { customerId, ruleId, restaurantId: rule.restaurantId, unitId: unit?.id ?? null, openedAt: now },
    update: { openedAt: now, unitId: unit?.id ?? null },
  });
}

/** O cliente tocou em "Já avaliei": cria o pedido (com a hora em que abriu o Google) e já tenta conferir no Google. */
export async function confirmGoogleReview(customerId: string, ruleId: string) {
  const intent = await prisma.googleReviewIntent.findUnique({ where: { customerId_ruleId: { customerId, ruleId } } });
  // Sem a marca de abertura (ex.: o celular não conseguiu avisar), o pedido segue sem conferência automática: o lugar decide.
  const claim = await requestInteraction(customerId, ruleId, { openedAt: intent?.openedAt, unitId: intent?.unitId });
  if (intent) await prisma.googleReviewIntent.delete({ where: { id: intent.id } }).catch(() => undefined);
  if (claim.openedAt) await verifyGoogleClaims({ claimId: claim.id }, { minIntervalMs: 0 });
  return claim.id;
}

/** Estado do pedido de avaliação do cliente (para a tela "Conferindo sua avaliação"). */
export async function googleReviewState(customerId: string, ruleId: string, opts: { check?: boolean } = {}) {
  let claim = await prisma.interactionClaim.findFirst({ where: { customerId, ruleId }, orderBy: { createdAt: 'desc' } });
  if (claim?.status === 'PENDING' && claim.openedAt && opts.check) {
    await verifyGoogleClaims({ claimId: claim.id });
    claim = await prisma.interactionClaim.findUnique({ where: { id: claim.id } });
  }
  if (!claim) return null;
  // A conferência automática vale quando o Google está ligado, a unidade tem o perfil escolhido e o pedido tem a hora de abertura.
  const verifying =
    googleConfigured() &&
    !!claim.openedAt &&
    !!(await prisma.googleConnection.findUnique({ where: { restaurantId: claim.restaurantId }, select: { id: true } })) &&
    (await prisma.unit.count({ where: { restaurantId: claim.restaurantId, googleLocation: { not: null }, ...(claim.unitId ? { id: claim.unitId } : {}) } })) > 0;
  return { status: claim.status, points: claim.points, autoAt: claim.autoAt, by: claim.decidedBy, verifying };
}

/**
 * Procura, no Google, a avaliação de cada pedido pendente e libera os pontos de quem tem uma que bate (nome + escrita depois de abrir).
 * Quem não é achado continua pendente: o lugar decide, ou os pontos entram em 24 h se o lugar escolheu o modo automático.
 * Nunca lança erro: se o Google falhar, o pedido segue pelo caminho de sempre.
 */
export async function verifyGoogleClaims(where: { restaurantId?: string; claimId?: string } = {}, opts: { minIntervalMs?: number } = {}) {
  if (!googleConfigured()) return 0;
  const now = Date.now();
  const rows = await prisma.interactionClaim.findMany({
    where: {
      ...(where.restaurantId ? { restaurantId: where.restaurantId } : {}),
      ...(where.claimId ? { id: where.claimId } : {}),
      status: 'PENDING',
      googleReviewId: null,
      openedAt: { gte: new Date(now - 3 * 24 * 3_600_000) },
      OR: [{ checkedAt: null }, { checkedAt: { lt: new Date(now - (opts.minIntervalMs ?? 60_000)) } }],
    },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  const claims = rows.filter((c) => actionKind(c.label) === 'google' && c.openedAt);
  if (!claims.length) return 0;

  let approved = 0;
  for (const restaurantId of [...new Set(claims.map((c) => c.restaurantId))]) {
    const mine = claims.filter((c) => c.restaurantId === restaurantId);
    const conn = await prisma.googleConnection.findUnique({ where: { restaurantId } });
    const units = await prisma.unit.findMany({ where: { restaurantId, googleLocation: { not: null } }, select: { id: true, googleLocation: true } });
    if (!conn || !units.length) continue;
    try {
      const since = new Date(Math.min(...mine.map((c) => c.openedAt!.getTime())) - CLOCK_SLACK_MS);
      // Cada pedido é procurado no perfil da unidade que o cliente abriu; sem unidade conhecida, em todos os perfis ligados.
      const locations = [...new Set(units.map((u) => u.googleLocation!))];
      const reviewsBy = new Map<string, Awaited<ReturnType<typeof listReviews>>>();
      for (const loc of locations) reviewsBy.set(loc, await listReviews(conn.refreshTokenEnc, loc, since));
      const locOf = (unitId: string | null) => units.find((u) => u.id === unitId)?.googleLocation ?? null;

      const groups = new Map<string, typeof mine>();
      for (const c of mine) {
        const key = locOf(c.unitId) ?? '*';
        groups.set(key, [...(groups.get(key) ?? []), c]);
      }
      for (const [key, list] of groups) {
        const reviews = key === '*' ? [...reviewsBy.values()].flat() : (reviewsBy.get(key) ?? []);
        const pending: PendingClaim[] = list.map((c) => ({ id: c.id, customerName: c.customer.name, openedAt: c.openedAt! }));
        for (const [claimId, review] of matchClaims(pending, reviews)) {
          try {
            if ((await decideInteraction(claimId, restaurantId, true, 'GOOGLE', { googleReviewId: review.id })).decided) approved += 1;
          } catch (e) {
            // A mesma avaliação já confirmou outro pedido (restrição única): este continua pendente.
            console.error('[google/conferir]', e instanceof Error ? e.message : e);
          }
        }
      }
      await prisma.googleConnection.update({ where: { restaurantId }, data: { lastCheckedAt: new Date(), lastError: null } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[google/conferir]', msg);
      await prisma.googleConnection.update({ where: { restaurantId }, data: { lastError: msg.slice(0, 300) } }).catch(() => undefined);
    }
    await prisma.interactionClaim.updateMany({ where: { id: { in: mine.map((c) => c.id) }, status: 'PENDING' }, data: { checkedAt: new Date() } });
  }
  return approved;
}
