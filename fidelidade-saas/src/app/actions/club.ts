'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { BusinessError } from '@/lib/claims';
import { addSubscriber, cancelSubscription, registerPayment, requestSubscription, savePlan, setPlanActive, undoPayment } from '@/lib/club-db';
import { fail, type FormState } from '@/lib/form';
import { TOO_MANY, allow } from '@/lib/rate-limit';
import { getAdmin, getCustomer, requireActiveRestaurant } from '@/lib/session';

const ID = /^[0-9a-f-]{36}$/;
const refresh = () => { revalidatePath('/dashboard/clube'); revalidatePath('/perfil/clube'); revalidatePath('/dashboard/financeiro'); };

/** Cria ou atualiza um plano (os serviços vêm como `svc` e a quantidade de cada um como `qty_<id>`). */
export async function saveClubPlan(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('id') ?? '');
  const items = [...new Set(formData.getAll('svc').map(String))].map((serviceId) => ({ serviceId, quantity: formData.get(`qty_${serviceId}`) }));
  try {
    await savePlan(restaurant.id, ID.test(id) ? id : null, { name: formData.get('name'), description: formData.get('description'), price: formData.get('price'), items });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  refresh();
  return { ok: id ? 'Plano atualizado.' : 'Plano criado.' };
}

export async function toggleClubPlan(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('id') ?? '');
  if (ID.test(id)) await setPlanActive(restaurant.id, id, formData.get('active') === '1');
  refresh();
}

/** O lugar cadastra um assinante pelo CPF. */
export async function addClubSubscriber(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requireActiveRestaurant();
  if (await getAdmin()) return fail('No modo suporte não dá para cadastrar assinantes.', formData);
  try {
    await addSubscriber(restaurant.id, { cpf: String(formData.get('cpf') ?? ''), planId: String(formData.get('planId') ?? ''), paid: formData.get('paid') === 'on' });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  refresh();
  return { ok: 'Assinante cadastrado.' };
}

async function ownerSub(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('id') ?? '');
  return { restaurant, id: ID.test(id) ? id : null, support: !!(await getAdmin()) };
}

/** Roda a ação do dono; se for recusada por regra de negócio, volta à tela mostrando o motivo. */
async function ownerAction(formData: FormData, run: (restaurantId: string, id: string) => Promise<void>) {
  const { restaurant, id, support } = await ownerSub(formData);
  let erro = '';
  if (support) erro = 'No modo suporte não dá para alterar assinaturas.';
  else if (id) {
    try { await run(restaurant.id, id); } catch (e) { if (e instanceof BusinessError) erro = e.message; else throw e; }
  }
  refresh();
  if (erro) redirect('/dashboard/clube?erro=' + encodeURIComponent(erro));
}

/** Registra o pagamento da mensalidade (cobre mais um ciclo e entra no financeiro). */
export async function payClubSubscription(formData: FormData) { await ownerAction(formData, (r, id) => registerPayment(r, id)); }
export async function undoClubPayment(formData: FormData) { await ownerAction(formData, (r, id) => undoPayment(r, id)); }
export async function cancelClubByOwner(formData: FormData) { await ownerAction(formData, (r, id) => cancelSubscription(id, { restaurantId: r })); }

// ---------- cliente ----------
/** O cliente pede a assinatura de um plano; o primeiro pagamento é feito no balcão. */
export async function subscribeToPlan(formData: FormData) {
  const customer = await getCustomer();
  const planId = String(formData.get('planId') ?? '');
  if (!customer) redirect(`/entrar?next=${encodeURIComponent(String(formData.get('next') || '/lugares'))}`);
  if (!ID.test(planId)) redirect('/perfil/clube');
  if (!(await allow(`club:${customer.id}`, 20, 3600))) redirect('/perfil/clube?erro=' + encodeURIComponent(TOO_MANY));
  try {
    await requestSubscription(customer.id, planId);
  } catch (e) {
    if (e instanceof BusinessError) redirect('/perfil/clube?erro=' + encodeURIComponent(e.message));
    throw e;
  }
  refresh();
  redirect('/perfil/clube?pedido=1');
}

export async function cancelClubByCustomer(formData: FormData) {
  const customer = await getCustomer();
  const id = String(formData.get('id') ?? '');
  if (customer && ID.test(id)) { try { await cancelSubscription(id, { customerId: customer.id }); } catch (e) { if (!(e instanceof BusinessError)) throw e; } }
  refresh();
}
