import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { goalText, pointsTitle } from './notify-text';

type Db = Prisma.TransactionClient | typeof prisma;

export async function notify(db: Db, data: { customerId: string; restaurantId?: string; title: string; body: string; href?: string }) {
  await db.notification.create({ data });
}

/** Aviso de pontos recebidos, já com a meta do próximo prêmio. */
export async function notifyPoints(db: Db, customerId: string, restaurantId: string, points: number, balanceAfter: number, description: string) {
  const [restaurant, rewards] = await Promise.all([
    db.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } }),
    db.reward.findMany({ where: { restaurantId, active: true }, select: { name: true, pointsCost: true } }),
  ]);
  if (!restaurant) return;
  const goal = goalText(balanceAfter - points, balanceAfter, rewards);
  await notify(db, {
    customerId,
    restaurantId,
    title: pointsTitle(points, restaurant.name),
    body: [description.replace(/[.!\s]*$/, '.'), goal].filter(Boolean).join(' '),
    href: goal?.startsWith('Agora') ? `/lugar/${restaurantId}/premios` : `/lugar/${restaurantId}`,
  });
}

/** Quantos avisos o cliente ainda não leu (para a bolinha do menu). */
export async function unreadCount(customerId: string) {
  return prisma.notification.count({ where: { customerId, readAt: null } });
}
