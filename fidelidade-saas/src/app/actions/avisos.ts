'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCustomer } from '@/lib/session';

/** Marca os avisos do cliente como lidos (apaga a bolinha do menu). Com `restaurantId`, só os daquele lugar (a tela filtrada). */
export async function markNotificationsRead(restaurantId?: string) {
  const customer = await getCustomer();
  if (!customer) return;
  const only = restaurantId && /^[0-9a-f-]{36}$/.test(restaurantId) ? { restaurantId } : {};
  const done = await prisma.notification.updateMany({ where: { customerId: customer.id, readAt: null, ...only }, data: { readAt: new Date() } });
  if (done.count > 0) revalidatePath('/', 'layout');
}
