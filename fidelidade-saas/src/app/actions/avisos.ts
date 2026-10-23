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

/** Marca como lidos só estes avisos (os de um dia que o cliente acabou de abrir). Ignora ids que não sejam dele. */
export async function markNoticesRead(ids: string[]) {
  const customer = await getCustomer();
  if (!customer) return;
  const clean = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 200);
  if (clean.length === 0) return;
  const done = await prisma.notification.updateMany({ where: { id: { in: clean }, customerId: customer.id, readAt: null }, data: { readAt: new Date() } });
  if (done.count > 0) revalidatePath('/', 'layout');
}
