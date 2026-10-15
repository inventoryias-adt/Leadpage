import 'server-only';
import { prisma } from './db';
import { dayKeyBR } from './challenges';
import { birthdaysFor } from './birthday';
import { creditBirthdayGift } from './claims';

/**
 * Dá o presente de pontos aos clientes que fazem aniversário hoje (data de Brasília), nos lugares que ligaram o presente
 * e onde o cliente já tem carteira. Pode rodar quantas vezes quiser no dia: só credita uma vez por cliente, lugar e ano.
 */
export async function giveBirthdayGifts(now: Date = new Date()) {
  const [y, m, d] = dayKeyBR(now).split('-').map(Number);
  const dates = birthdaysFor(d, m, y);
  const wallets = await prisma.wallet.findMany({
    where: {
      restaurant: { subscriptionStatus: 'ACTIVE', birthdayPoints: { gt: 0 } },
      customer: { OR: dates.map((x) => ({ birthDay: x.day, birthMonth: x.month })) },
    },
    select: { customerId: true, restaurantId: true, restaurant: { select: { birthdayPoints: true } } },
    take: 5000,
  });
  let given = 0;
  for (const w of wallets) {
    const ok = await prisma.$transaction((tx) => creditBirthdayGift(tx, w.customerId, w.restaurantId, w.restaurant.birthdayPoints, y));
    if (ok) given++;
  }
  return { birthdayGifts: given };
}
