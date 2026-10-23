'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { claimBirthdayPerk } from '@/lib/birthday-perk-db';
import { BusinessError } from '@/lib/claims';
import { TOO_MANY, allow } from '@/lib/rate-limit';
import { getCustomer } from '@/lib/session';

const ID = /^[0-9a-f-]{36}$/;

/** O cliente aniversariante pega o presente de um lugar: gera o cupom e leva para a carteira daquele lugar. */
export async function claimBirthdayPerkAction(formData: FormData) {
  const customer = await getCustomer();
  const restaurantId = String(formData.get('restaurantId') ?? '');
  if (!ID.test(restaurantId)) redirect('/lugares');
  if (!customer) redirect(`/entrar?next=${encodeURIComponent(`/lugar/${restaurantId}`)}`);
  const back = (msg: string) => redirect(`/lugar/${restaurantId}?presente=${encodeURIComponent(msg)}`);
  if (!(await allow(`perk:${customer.id}`, 10, 3600))) back(TOO_MANY);
  try {
    await claimBirthdayPerk(customer.id, restaurantId);
  } catch (e) {
    if (e instanceof BusinessError) back(e.message);
    throw e;
  }
  revalidatePath('/carteira', 'layout');
  revalidatePath('/perfil', 'layout');
  redirect(`/carteira/${restaurantId}`);
}
