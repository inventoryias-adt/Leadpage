'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCustomer } from '@/lib/session';

/** Marca os avisos do cliente como lidos (apaga a bolinha do menu). */
export async function markNotificationsRead() {
  const customer = await getCustomer();
  if (!customer) return;
  const done = await prisma.notification.updateMany({ where: { customerId: customer.id, readAt: null }, data: { readAt: new Date() } });
  if (done.count > 0) revalidatePath('/', 'layout');
}
