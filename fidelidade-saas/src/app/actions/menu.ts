'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { BusinessError } from '@/lib/claims';
import { fail, type FormState } from '@/lib/form';
import { photoFromForm } from '@/lib/form-photo';
import { saveImageFromDataUrl } from '@/lib/images';
import { setOrderStatus } from '@/lib/orders-db';
import { canMove, validPrep, type OrderStatus } from '@/lib/orders';
import { MAX_BILL_CENTS, parseMoneyToCents } from '@/lib/points';
import { requireActiveRestaurant, requirePaidRestaurant } from '@/lib/session';

const MAX_MENU_ITEMS = 200;
const DEFAULT_CATEGORY = 'Cardápio';

const itemSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do produto.').max(80),
  description: z.string().trim().max(200).optional().default(''),
  category: z.string().trim().max(30, 'A categoria pode ter até 30 letras.').optional().default(''),
  price: z.string().trim().min(1, 'Informe o preço.').max(20),
  promo: z.string().trim().max(20).optional().default(''),
});

/** Preço digitado ("28,00") → centavos, ou o motivo de recusar. */
function money(input: string, what: string): number | { error: string } {
  const cents = parseMoneyToCents(input);
  if (cents == null || cents <= 0 || cents > MAX_BILL_CENTS) return { error: `${what} inválido. Use algo como 28,00.` };
  return cents;
}

/** Cria ou edita um item do cardápio (com `id` edita). A foto vem do computador ou da busca na web. */
export async function saveMenuItem(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);

  const price = money(parsed.data.price, 'Preço');
  if (typeof price !== 'number') return fail(price.error, formData);
  let promo: number | null = null;
  if (parsed.data.promo) {
    const p = money(parsed.data.promo, 'Preço promocional');
    if (typeof p !== 'number') return fail(p.error, formData);
    if (p >= price) return fail('O preço promocional precisa ser menor que o preço normal.', formData);
    promo = p;
  }
  const featured = formData.get('featured') === 'on';

  const existing = id ? await prisma.menuItem.findFirst({ where: { id, restaurantId: restaurant.id } }) : null;
  if (id && !existing) return { error: 'Produto não encontrado.' };
  if (!existing && (await prisma.menuItem.count({ where: { restaurantId: restaurant.id } })) >= MAX_MENU_ITEMS) {
    return fail(`Limite de ${MAX_MENU_ITEMS} produtos no cardápio atingido.`, formData);
  }

  try {
    const photo = await photoFromForm(formData);
    const imageId = photo ? await saveImageFromDataUrl(restaurant.id, photo, existing?.imageId) : (existing?.imageId ?? null);
    const data = { name: parsed.data.name, description: parsed.data.description || null, category: parsed.data.category || DEFAULT_CATEGORY, priceCents: price, promoCents: promo, featured, imageId };
    await prisma.$transaction(async (tx) => {
      if (featured) await tx.menuItem.updateMany({ where: { restaurantId: restaurant.id, featured: true, ...(existing ? { id: { not: existing.id } } : {}) }, data: { featured: false } }); // um só destaque
      if (existing) await tx.menuItem.update({ where: { id: existing.id }, data });
      else await tx.menuItem.create({ data: { ...data, restaurantId: restaurant.id } });
    });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  revalidatePath('/dashboard/cardapio');
  revalidatePath('/lugar', 'layout');
  return { ok: existing ? 'Produto atualizado.' : 'Produto adicionado ao cardápio.' };
}

/** Pausa ou volta a vender um item (acabou o estoque do dia, por exemplo) sem apagar. */
export async function setMenuItemActive(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === '1';
  await prisma.menuItem.updateMany({ where: { id, restaurantId: restaurant.id }, data: { active } });
  revalidatePath('/dashboard/cardapio');
  revalidatePath('/lugar', 'layout');
}

/** Item que já foi pedido não é apagado (o histórico precisa dele): só sai do cardápio. */
export async function removeMenuItem(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  const where = { id, restaurantId: restaurant.id };
  if (await prisma.orderItem.count({ where: { menuItemId: id } })) await prisma.menuItem.updateMany({ where, data: { active: false, featured: false } });
  else await prisma.menuItem.deleteMany({ where });
  revalidatePath('/dashboard/cardapio');
  revalidatePath('/lugar', 'layout');
}

/** Liga ou desliga os pedidos pelo app e define o "pronto em X min" mostrado ao cliente. */
export async function saveOrderSettings(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const enabled = formData.get('ordersEnabled') === 'on';
  const prep = Number(formData.get('orderPrepMin'));
  if (!validPrep(prep)) return fail('Escolha um tempo de preparo da lista.', formData);
  if (enabled && (await prisma.menuItem.count({ where: { restaurantId: restaurant.id, active: true } })) === 0) {
    return fail('Cadastre ao menos um produto no cardápio antes de ligar os pedidos.', formData);
  }
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { ordersEnabled: enabled, orderPrepMin: prep } });
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/lugar', 'layout');
  return { ok: enabled ? 'Pedidos ligados. Os clientes já podem pedir pelo app.' : 'Pedidos desligados.' };
}

/** O lugar muda o status de um pedido (preparar, pronto, retirado, cancelar). Erros voltam como aviso na própria tela. */
export async function advanceOrder(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('id') ?? '');
  const to = String(formData.get('to') ?? '') as OrderStatus;
  let erro = '';
  let pontos = 0;
  if (!['PREPARING', 'READY', 'PICKED_UP', 'CANCELED'].includes(to) || !canMove('RECEIVED', to)) erro = 'Ação inválida.';
  else {
    try {
      pontos = (await setOrderStatus(id, restaurant.id, to))?.pointsAwarded ?? 0;
    } catch (e) {
      if (!(e instanceof BusinessError)) throw e;
      erro = e.message;
    }
  }
  revalidatePath('/dashboard/pedidos');
  revalidatePath('/dashboard');
  redirect(`/dashboard/pedidos${erro ? `?erro=${encodeURIComponent(erro)}` : pontos > 0 ? `?pontos=${pontos}` : ''}`);
}
