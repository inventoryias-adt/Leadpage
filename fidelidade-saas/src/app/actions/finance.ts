'use server';

import { revalidatePath } from 'next/cache';
import { BusinessError } from '@/lib/claims';
import { prisma } from '@/lib/db';
import { fail, type FormState } from '@/lib/form';
import { isMonthKey, parseCommission } from '@/lib/finance';
import { deleteEntry, endRecurring, payCommission, saveEntry, undoPayout } from '@/lib/finance-db';
import { requireActiveRestaurant } from '@/lib/session';

const refresh = () => revalidatePath('/dashboard/financeiro');
const ID = /^[0-9a-f-]{36}$/;

/** Lança uma entrada ou despesa (avulsa ou fixa). */
export async function saveFinanceEntry(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requireActiveRestaurant();
  try {
    await saveEntry(restaurant.id, null, Object.fromEntries(formData));
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  refresh();
  return { ok: 'Lançamento salvo.' };
}

export async function deleteFinanceEntry(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('id') ?? '');
  if (ID.test(id)) await deleteEntry(restaurant.id, id);
  refresh();
}

/** "Encerrar" um lançamento fixo a partir do mês que está na tela. */
export async function endFinanceEntry(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('id') ?? '');
  const month = String(formData.get('month') ?? '');
  if (ID.test(id) && isMonthKey(month)) {
    try { await endRecurring(restaurant.id, id, month); } catch (e) { if (!(e instanceof BusinessError)) throw e; }
  }
  refresh();
}

/** Define a comissão (%) de um profissional. */
export async function saveCommissionPct(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('resourceId') ?? '');
  const bp = parseCommission(formData.get('pct'));
  if (!ID.test(id)) return fail('Profissional não encontrado.', formData);
  if (bp == null) return fail('Use um percentual de 0 a 100 (ex.: 40 ou 12,5).', formData);
  const done = await prisma.resource.updateMany({ where: { id, restaurantId: restaurant.id }, data: { commissionBp: bp } });
  if (done.count !== 1) return fail('Profissional não encontrado.', formData);
  refresh();
  return { ok: 'Comissão salva.' };
}

/** Registra que a comissão do mês foi paga (vira saída no fluxo de caixa). */
export async function payCommissionAction(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('resourceId') ?? '');
  const month = String(formData.get('month') ?? '');
  if (ID.test(id) && isMonthKey(month)) {
    try { await payCommission(restaurant.id, id, month); } catch (e) { if (!(e instanceof BusinessError)) throw e; }
  }
  refresh();
}

export async function undoCommissionAction(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('resourceId') ?? '');
  const month = String(formData.get('month') ?? '');
  if (ID.test(id) && isMonthKey(month)) await undoPayout(restaurant.id, id, month);
  refresh();
}
