import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { startOfMonthBR } from './points';
import { newVoucherCode } from './tokens';

/** Erro de regra de negócio, seguro para exibir ao usuário. */
export class BusinessError extends Error {}

/** Credita na carteira os pontos de um QR Code — uma única vez, de forma atômica. */
export async function creditClaim(token: string, customerId: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findUnique({ where: { token } });
    if (!claim) throw new BusinessError('QR Code inválido.');
    if (claim.redeemedAt) throw new BusinessError('Este QR Code já foi utilizado.');
    if (claim.expiresAt < new Date()) throw new BusinessError('Este QR Code expirou. Peça um novo no balcão.');

    // Condição `redeemedAt: null` garante que duas requisições simultâneas não creditem duas vezes.
    const marked = await tx.claim.updateMany({
      where: { id: claim.id, redeemedAt: null },
      data: { redeemedAt: new Date(), customerId },
    });
    if (marked.count !== 1) throw new BusinessError('Este QR Code já foi utilizado.');

    const wallet = await tx.wallet.upsert({
      where: { customerId_restaurantId: { customerId, restaurantId: claim.restaurantId } },
      create: { customerId, restaurantId: claim.restaurantId, balance: claim.points },
      update: { balance: { increment: claim.points } },
    });
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'EARN',
        points: claim.points,
        description: claim.description,
        claimId: claim.id,
      },
    });
    return { restaurantId: claim.restaurantId, points: claim.points };
  });
}

/** Troca pontos por um prêmio, respeitando saldo e o limite mensal de resgates por CPF. */
export async function redeemReward(customerId: string, rewardId: string) {
  return prisma.$transaction(async (tx) => {
    const reward = await tx.reward.findUnique({ where: { id: rewardId }, include: { restaurant: true } });
    if (!reward || !reward.active || reward.restaurant.subscriptionStatus !== 'ACTIVE') {
      throw new BusinessError('Prêmio indisponível.');
    }
    const { restaurant } = reward;

    const found = await tx.wallet.findUnique({
      where: { customerId_restaurantId: { customerId, restaurantId: restaurant.id } },
    });
    if (!found) throw new BusinessError('Saldo insuficiente.');

    // Trava a carteira: resgates simultâneos do mesmo cliente passam um de cada vez,
    // então saldo e limite mensal são verificados sobre dados consistentes.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Wallet" WHERE id = ${found.id} FOR UPDATE`);
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: found.id } });

    const usedThisMonth = await tx.redemption.count({
      where: { customerId, restaurantId: restaurant.id, createdAt: { gte: startOfMonthBR() } },
    });
    if (usedThisMonth >= restaurant.maxRedeemsPerMonth) {
      throw new BusinessError(
        `Limite de ${restaurant.maxRedeemsPerMonth} resgates por mês atingido neste restaurante.`,
      );
    }
    if (wallet.balance < reward.pointsCost) throw new BusinessError('Saldo insuficiente.');

    let code = newVoucherCode();
    while (await tx.redemption.findUnique({ where: { restaurantId_code: { restaurantId: restaurant.id, code } } })) {
      code = newVoucherCode();
    }

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: reward.pointsCost } } });
    const redemption = await tx.redemption.create({
      data: {
        restaurantId: restaurant.id,
        customerId,
        walletId: wallet.id,
        rewardId: reward.id,
        rewardName: reward.name,
        pointsCost: reward.pointsCost,
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
    return redemption;
  });
}
