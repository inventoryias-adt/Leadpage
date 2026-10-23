import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { dayKeyBR, periodRange } from './challenges';
import { maxAcceptedAccuracyM, validCoords } from './geo';
import { nearestUnit } from './units';
import { startOfMonthBR } from './points';
import { newVoucherCode } from './tokens';
import { notify, notifyPoints } from './notifications';
import { planShared } from './shared-points';
import { applyPromos, promoBadge, qualifiesForAudience } from './promos';

/** Erro de regra de negócio, seguro para exibir ao usuário. */
export class BusinessError extends Error {}

type Tx = Prisma.TransactionClient;

/** Soma pontos na carteira (criando-a se preciso) e registra a movimentação. */
export async function creditWallet(
  tx: Tx,
  customerId: string,
  restaurantId: string,
  points: number,
  description: string,
  extra: { claimId?: string } = {},
) {
  const wallet = await tx.wallet.upsert({
    where: { customerId_restaurantId: { customerId, restaurantId } },
    create: { customerId, restaurantId, balance: points },
    update: { balance: { increment: points } },
  });
  await tx.transaction.create({
    data: { walletId: wallet.id, type: 'EARN', points, description, ...extra },
  });
  await notifyPoints(tx, customerId, restaurantId, points, wallet.balance, description);
  return wallet;
}

/** Presente de aniversário: um por cliente, lugar e ano (a restrição única impede repetir). Devolve true se creditou agora. */
export async function creditBirthdayGift(tx: Tx, customerId: string, restaurantId: string, points: number, year: number) {
  const created = await tx.birthdayGift.createMany({ data: [{ customerId, restaurantId, year, points }], skipDuplicates: true });
  if (created.count !== 1) return false;
  await creditWallet(tx, customerId, restaurantId, points, 'Presente de aniversário');
  return true;
}

type ProgressClient = Prisma.TransactionClient | typeof prisma;
type ChallengeRow = {
  id: string;
  kind: 'PURCHASES' | 'CHECKINS';
  target: number;
  minAmountCents: number;
  period: 'WEEK' | 'MONTH';
};

/** Quanto o cliente já cumpriu do desafio no período corrente. */
export async function challengeCount(db: ProgressClient, c: ChallengeRow, customerId: string, restaurantId: string, now = new Date()) {
  const { start, end } = periodRange(c.period, now);
  if (c.kind === 'CHECKINS') {
    return db.checkIn.count({ where: { customerId, restaurantId, createdAt: { gte: start, lt: end } } });
  }
  return db.claim.count({
    where: { customerId, restaurantId, redeemedAt: { gte: start, lt: end }, amountCents: { gte: Math.max(c.minAmountCents, 1) } },
  });
}

/** Concede o bônus dos desafios cumpridos (uma vez por cliente em cada período). */
async function awardChallenges(tx: Tx, customerId: string, restaurantId: string, kind: 'PURCHASES' | 'CHECKINS', now = new Date()) {
  const challenges = await tx.challenge.findMany({ where: { restaurantId, kind, active: true } });
  const awarded: { title: string; points: number }[] = [];

  for (const c of challenges) {
    if ((await challengeCount(tx, c, customerId, restaurantId, now)) < c.target) continue;
    const { key } = periodRange(c.period, now);
    // skipDuplicates + unique(challengeId, customerId, periodKey): duas requisições simultâneas premiam só uma vez.
    const created = await tx.challengeCompletion.createMany({
      data: [{ challengeId: c.id, customerId, periodKey: key }],
      skipDuplicates: true,
    });
    if (created.count === 1) {
      await creditWallet(tx, customerId, restaurantId, c.bonusPoints, `Desafio concluído: ${c.title}`);
      awarded.push({ title: c.title, points: c.bonusPoints });
    }
  }
  return awarded;
}

/** Credita na carteira os pontos de um QR Code — uma única vez, de forma atômica. */
export async function creditClaim(token: string, customerId: string) {
  return prisma.$transaction((tx) => creditClaimWith(tx, token, customerId));
}

/** O mesmo crédito, dentro de uma transação já aberta (o agendamento concluído usa para creditar pontos e fechar de uma vez). */
export async function creditClaimWith(tx: Tx, token: string, customerId: string) {
  {
    const claim = await tx.claim.findUnique({ where: { token } });
    if (!claim) throw new BusinessError('QR Code inválido.');
    if (claim.redeemedAt) throw new BusinessError('Este QR Code já foi utilizado.');
    if (claim.expiresAt < new Date()) throw new BusinessError('Este QR Code expirou. Peça um novo no balcão.');

    // Condição `redeemedAt: null` garante que duas requisições simultâneas não creditem duas vezes.
    const now = new Date();
    const marked = await tx.claim.updateMany({
      where: { id: claim.id, redeemedAt: null },
      data: { redeemedAt: now, customerId },
    });
    if (marked.count !== 1) throw new BusinessError('Este QR Code já foi utilizado.');

    // Campanhas: as de todos já entraram nos pontos do QR; aqui entram as de público específico (primeira compra,
    // quem sumiu) e registramos cada campanha aplicada para o relatório.
    let points = claim.points;
    let description = claim.description;
    if (claim.amountCents > 0 && claim.billPoints != null) {
      const promos = await tx.promotion.findMany({ where: { restaurantId: claim.restaurantId } });
      const at = claim.createdAt;
      const prior = await tx.claim.aggregate({
        where: { customerId, restaurantId: claim.restaurantId, redeemedAt: { not: null }, amountCents: { gt: 0 }, id: { not: claim.id } },
        _count: true,
        _max: { redeemedAt: true },
      });
      const history = { purchases: prior._count, lastPurchaseAt: prior._max.redeemedAt };
      const everyone = promos.filter((p) => p.audience === 'ALL');
      const eligible = promos.filter((p) => p.audience === 'ALL' || qualifiesForAudience(p, history, at));
      const before = applyPromos(claim.billPoints, claim.amountCents, everyone, at);
      const after = applyPromos(claim.billPoints, claim.amountCents, eligible, at);
      const delta = after.points - before.points;
      if (delta > 0) {
        points += delta;
        const extra = after.applied.filter((p) => p.audience !== 'ALL').map((p) => `${promoBadge(p)} · ${p.title}`);
        description = extra.length ? `${description} + ${extra.join(' + ')}` : description;
        await tx.claim.update({ where: { id: claim.id }, data: { points, description } });
      }
      const uses = after.parts.filter((x) => x.points > 0);
      if (uses.length) {
        await tx.promotionUse.createMany({
          data: uses.map((x) => ({ promotionId: x.promo.id, restaurantId: claim.restaurantId, title: x.promo.title, claimId: claim.id, customerId, points: x.points, amountCents: claim.amountCents })),
          skipDuplicates: true,
        });
      }
    }

    await creditWallet(tx, customerId, claim.restaurantId, points, description, { claimId: claim.id });

    // Primeira compra de verdade neste restaurante? Então quem indicou o cliente é premiado.
    if (claim.amountCents > 0) {
      const purchases = await tx.claim.count({
        where: { customerId, restaurantId: claim.restaurantId, redeemedAt: { not: null }, amountCents: { gt: 0 } },
      });
      if (purchases === 1) await rewardReferrer(tx, customerId, claim.restaurantId, now);
    }

    const bonuses = await awardChallenges(tx, customerId, claim.restaurantId, 'PURCHASES', now);
    return { restaurantId: claim.restaurantId, points, bonuses };
  }
}

async function rewardReferrer(tx: Tx, referredId: string, restaurantId: string, now: Date) {
  const referral = await tx.referral.findUnique({ where: { restaurantId_referredId: { restaurantId, referredId } } });
  if (!referral || referral.status !== 'PENDING') return;
  const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId }, select: { referralPoints: true } });
  if (!restaurant || restaurant.referralPoints <= 0) return;

  const flipped = await tx.referral.updateMany({
    where: { id: referral.id, status: 'PENDING' },
    data: { status: 'REWARDED', rewardedAt: now },
  });
  if (flipped.count !== 1) return;

  const friend = await tx.customer.findUnique({ where: { id: referredId }, select: { name: true } });
  const firstName = friend?.name.split(' ')[0] ?? 'Seu amigo';
  await creditWallet(tx, referral.referrerId, restaurantId, restaurant.referralPoints, `Indicação: ${firstName} fez a primeira compra`);
}

/** Check-in por proximidade: +pontos uma vez por dia, só se o cliente estiver em alguma unidade da marca. */
export async function performCheckIn(customerId: string, restaurantId: string, lat: unknown, lng: unknown, accuracy?: number) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE') throw new BusinessError('Lugar indisponível.');
  if (restaurant.checkInPoints <= 0) throw new BusinessError('Este lugar não oferece pontos por check-in.');

  const units = await prisma.unit.findMany({ where: { restaurantId, active: true } });
  if (!units.some((u) => u.latitude != null && u.longitude != null)) {
    throw new BusinessError('Este lugar ainda não configurou a localização para check-in.');
  }
  if (!validCoords(lat, lng)) throw new BusinessError('Não conseguimos ler a sua localização. Tente de novo.');

  const near = nearestUnit(units, { lat, lng: lng as number })!;
  if (near.meters > restaurant.checkInRadiusM) {
    // De propósito sem a distância: quem está de fora não pode ir "calibrando" até a borda do raio.
    const where = units.length > 1 ? 'em uma das unidades' : 'no estabelecimento';
    throw new BusinessError(`Não foi possível confirmar que você está ${where}. Faça o check-in estando dentro do local.`);
  }
  // Dentro do raio, mas com a leitura do GPS imprecisa demais para o raio escolhido: orienta em vez de acusar (e sem números).
  if (accuracy != null && Number.isFinite(accuracy) && accuracy > maxAcceptedAccuracyM(restaurant.checkInRadiusM)) {
    throw new BusinessError('Sinal de GPS fraco. Vá para perto de uma janela ou da porta, espere alguns segundos e tente de novo.');
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.checkIn.createMany({
      data: [{ customerId, restaurantId, unitId: near.unit.id, dayKey: dayKeyBR(), distanceM: Math.round(near.meters) }],
      skipDuplicates: true,
    });
    if (created.count !== 1) throw new BusinessError('Você já fez check-in aqui hoje. Volte amanhã!');

    await creditWallet(tx, customerId, restaurantId, restaurant.checkInPoints, units.length > 1 ? `Check-in: ${near.unit.name}` : 'Check-in no local');
    const bonuses = await awardChallenges(tx, customerId, restaurantId, 'CHECKINS');
    return { points: restaurant.checkInPoints, bonuses };
  });
}

export type BagItem = { rewardId: string; qty: number };

/**
 * Troca pontos por um ou mais prêmios de um restaurante (a "sacola").
 * Tudo numa transação: saldo e limite mensal por CPF são checados com a carteira travada.
 * Cada unidade gera um voucher próprio, que o balcão valida individualmente.
 */
/**
 * Troca pontos por prêmios. Com `useShared`, o que faltar na carteira do lugar é completado com pontos de outras carteiras
 * do cliente (lugares com "pontos daqui valem em outros lugares" ligado), convertidos pelo valor de cada ponto
 * quando este lugar aceita pontos de outros. Tudo na mesma transação, com as carteiras travadas em ordem fixa.
 */
export async function redeemItems(customerId: string, restaurantId: string, rawItems: BagItem[], opts: { useShared?: boolean; birthday?: { since: Date } } = {}) {
  const merged = new Map<string, number>();
  for (const it of rawItems) {
    const qty = Math.floor(Number(it.qty));
    if (!it.rewardId || !Number.isFinite(qty) || qty < 1) continue;
    merged.set(it.rewardId, Math.min(10, (merged.get(it.rewardId) ?? 0) + qty));
  }
  const items = [...merged].map(([rewardId, qty]) => ({ rewardId, qty }));
  const totalQty = items.reduce((n, i) => n + i.qty, 0);
  if (totalQty === 0) throw new BusinessError('Sua sacola está vazia.');
  if (totalQty > 10) throw new BusinessError('Resgate no máximo 10 itens por vez.');

  return prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE') throw new BusinessError('Prêmio indisponível.');

    const rewards = await tx.reward.findMany({ where: { id: { in: items.map((i) => i.rewardId) }, restaurantId, active: true } });
    if (rewards.length !== items.length) throw new BusinessError('Algum prêmio da sacola não está mais disponível. Atualize a página.');
    // O presente do aniversariante só sai pelo caminho próprio (que confere o aniversário) e sozinho, nunca misturado na sacola.
    const birthdayItems = rewards.filter((r) => r.birthdayOnly);
    if (birthdayItems.length > 0 && (!opts.birthday || rewards.length !== 1 || totalQty !== 1)) throw new BusinessError('Prêmio indisponível.');
    const freeBirthday = !!opts.birthday && birthdayItems.length === 1 && birthdayItems[0].pointsCost === 0;

    const useShared = Boolean(opts.useShared) && restaurant.pointsAcceptIn;
    let found = await tx.wallet.findUnique({ where: { customerId_restaurantId: { customerId, restaurantId } } });
    if (!found && !useShared && !freeBirthday) throw new BusinessError('Saldo insuficiente.');
    if (!found) found = await tx.wallet.create({ data: { customerId, restaurantId } }); // só vive se o resgate completar (o presente grátis cria a carteira de quem ainda não tem)

    // Trava a carteira: resgates simultâneos do mesmo cliente passam um de cada vez. Com pontos de outros lugares
    // travamos todas as carteiras do cliente, sempre em ordem de id, para dois resgates cruzados não se travarem.
    if (useShared) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Wallet" WHERE "customerId" = ${customerId} ORDER BY id FOR UPDATE`);
    else await tx.$queryRaw(Prisma.sql`SELECT id FROM "Wallet" WHERE id = ${found.id} FOR UPDATE`);
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: found.id } });

    if (opts.birthday) {
      // Um presente de aniversário por cliente e lugar a cada ano (conferido depois do travamento da carteira, então dois toques seguidos não passam).
      const already = await tx.redemption.count({ where: { customerId, restaurantId, reward: { birthdayOnly: true }, createdAt: { gte: opts.birthday.since } } });
      if (already > 0) throw new BusinessError('Você já pegou o presente de aniversário deste lugar este ano.');
    } else {
      const usedThisMonth = await tx.redemption.count({
        where: { customerId, restaurantId, reward: { birthdayOnly: false }, createdAt: { gte: startOfMonthBR() } },
      });
      const limit = restaurant.maxRedeemsPerMonth;
      if (usedThisMonth >= limit) {
        throw new BusinessError(`Limite de ${limit} resgates por mês atingido neste estabelecimento.`);
      }
      if (usedThisMonth + totalQty > limit) {
        const left = limit - usedThisMonth;
        throw new BusinessError(`Você ainda pode resgatar ${left} ${left === 1 ? 'item' : 'itens'} neste mês (limite de ${limit} por CPF).`);
      }
    }

    const byId = new Map(rewards.map((r) => [r.id, r]));
    const totalCost = items.reduce((sum, i) => sum + byId.get(i.rewardId)!.pointsCost * i.qty, 0);
    const usedShared: { name: string; take: number }[] = [];
    if (wallet.balance < totalCost) {
      if (!useShared) throw new BusinessError('Saldo insuficiente.');
      const others = await tx.wallet.findMany({
        where: { customerId, restaurantId: { not: restaurantId }, balance: { gt: 0 }, restaurant: { pointsShareOut: true, subscriptionStatus: 'ACTIVE' } },
        include: { restaurant: { select: { id: true, name: true, pointsPerReal: true } } },
      });
      const plan = planShared(
        totalCost - wallet.balance,
        others.map((w) => ({ walletId: w.id, restaurantId: w.restaurantId, name: w.restaurant.name, balance: w.balance, pointsPerReal: w.restaurant.pointsPerReal })),
        restaurant.pointsPerReal,
      );
      if (!plan.ok) throw new BusinessError('Saldo insuficiente, mesmo somando os pontos de outros lugares.');
      for (const part of plan.parts) {
        await tx.wallet.update({ where: { id: part.walletId }, data: { balance: { decrement: part.take } } });
        await tx.transaction.create({ data: { walletId: part.walletId, type: 'SHARED_OUT', points: part.take, description: `Usados em ${restaurant.name}: completar um resgate` } });
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: part.gives } } });
        await tx.transaction.create({ data: { walletId: wallet.id, type: 'SHARED_IN', points: part.gives, description: `Pontos vindos de ${part.name}` } });
        usedShared.push({ name: part.name, take: part.take });
      }
    }

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: totalCost } } });

    const used = new Set(
      (await tx.redemption.findMany({ where: { restaurantId }, select: { code: true } })).map((r) => r.code),
    );
    const created = [];
    for (const { rewardId, qty } of items) {
      const reward = byId.get(rewardId)!;
      for (let n = 0; n < qty; n++) {
        let code = newVoucherCode();
        while (used.has(code)) code = newVoucherCode();
        used.add(code);

        const redemption = await tx.redemption.create({
          data: {
            restaurantId,
            customerId,
            walletId: wallet.id,
            rewardId: reward.id,
            rewardName: reward.name,
            pointsCost: reward.pointsCost,
            cashCents: reward.cashCents,
            code,
          },
        });
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'REDEEM',
            points: reward.pointsCost,
            description: `Resgate: ${reward.name}`,
            redemptionId: redemption.id,
          },
        });
        created.push(redemption);
      }
    }
    await notify(tx, {
      customerId,
      restaurantId,
      title: `${created.length === 1 ? 'Prêmio resgatado' : 'Prêmios resgatados'} · ${restaurant.name}`,
      body: `${created.map((c) => c.rewardName).join(', ')}. Mostre ${created.length === 1 ? 'o código' : 'os códigos'} no balcão para retirar.${usedShared.length ? ` Completamos com pontos de ${usedShared.map((u) => u.name).join(', ')}.` : ''}`,
      href: `/carteira/${restaurantId}`,
    });
    return created;
  });
}

/** Troca de um único prêmio (botão "Resgatar" da carteira). */
export async function redeemReward(customerId: string, rewardId: string) {
  const reward = await prisma.reward.findUnique({ where: { id: rewardId }, select: { restaurantId: true, active: true, birthdayOnly: true } });
  if (!reward || !reward.active || reward.birthdayOnly) throw new BusinessError('Prêmio indisponível.');
  const [redemption] = await redeemItems(customerId, reward.restaurantId, [{ rewardId, qty: 1 }]);
  return redemption;
}
