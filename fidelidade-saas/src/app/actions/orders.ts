'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { BusinessError } from '@/lib/claims';
import { fail, type OrderState } from '@/lib/form';
import { cancelOrder, placeOrder } from '@/lib/orders-db';
import { TOO_MANY, allow } from '@/lib/rate-limit';
import { getCustomer } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/;

/** O cliente confirma a sacola. Itens, preços e total são conferidos de novo aqui (do navegador só vem "quais itens e quantos"). */
export async function placeOrderAction(_: OrderState, formData: FormData): Promise<OrderState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Sua sessão expirou. Entre novamente para pedir.' };
  const restaurantId = String(formData.get('restaurantId') ?? '');
  if (!UUID.test(restaurantId)) return { error: 'Lugar inválido.' };
  if (!(await allow(`order:${customer.id}`, 15, 3600))) return { error: TOO_MANY };

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'));
  } catch {
    return { error: 'Não foi possível ler a sacola. Atualize a página.' };
  }
  const unitId = String(formData.get('unitId') ?? '');
  try {
    const order = await placeOrder(customer.id, restaurantId, items, { unitId: UUID.test(unitId) ? unitId : undefined, note: String(formData.get('note') ?? '') });
    revalidatePath('/perfil/pedidos');
    return { order: { id: order.id, code: order.code, totalCents: order.totalCents, prepMin: order.prepMin } };
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    throw e;
  }
}

/** O cliente cancela um pedido que o lugar ainda não começou a preparar. */
export async function cancelMyOrder(formData: FormData) {
  const customer = await getCustomer();
  if (!customer) redirect('/entrar?next=/perfil/pedidos');
  const id = String(formData.get('id') ?? '');
  let erro = '';
  try {
    if (UUID.test(id)) await cancelOrder(id, 'CUSTOMER', { customerId: customer.id });
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
    erro = e.message;
  }
  revalidatePath('/perfil/pedidos');
  revalidatePath('/dashboard/pedidos');
  redirect(`/perfil/pedidos${erro ? `?erro=${encodeURIComponent(erro)}` : '?cancelado=1'}`);
}
