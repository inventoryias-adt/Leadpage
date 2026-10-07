'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { isValidCpf, normalizePhone, onlyDigits } from '@/lib/br';
import { BusinessError, creditClaim, performCheckIn, redeemItems, redeemReward, type BagItem } from '@/lib/claims';
import { newReferralCode } from '@/lib/tokens';
import { endCustomerSession, getCustomer, startCustomerSession } from '@/lib/session';
import { fail, safeNext, type BagState, type FormState } from '@/lib/form';
import { TOO_MANY, allow, clientIp } from '@/lib/rate-limit';

const authSchema = z.object({
  cpf: z.string().refine(isValidCpf, 'CPF inválido.'),
  phone: z.string().refine((v) => normalizePhone(v) !== null, 'Telefone inválido. Use DDD + número.'),
  name: z.string().trim().max(80).default(''),
});

/**
 * Login rápido por CPF + telefone (cria a conta no primeiro acesso).
 * Se vier um `token`, já credita os pontos do QR Code depois de autenticar.
 */
export async function customerAuth(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = authSchema.safeParse({
    cpf: formData.get('cpf') ?? '',
    phone: formData.get('phone') ?? '',
    name: formData.get('name') ?? '',
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);

  const cpf = onlyDigits(parsed.data.cpf);
  const phone = normalizePhone(parsed.data.phone)!;

  // CPF + telefone é uma credencial fraca: limita por IP e por CPF alvo.
  const ip = await clientIp();
  const [okIp, okCpf] = await Promise.all([allow(`cust:ip:${ip}`, 30, 900), allow(`cust:cpf:${cpf}`, 8, 900)]);
  if (!okIp || !okCpf) return fail(TOO_MANY, formData);

  let customer = await prisma.customer.findUnique({ where: { cpf } });
  if (customer) {
    if (customer.phone !== phone) return fail('O telefone não confere com o cadastrado para este CPF.', formData);
  } else {
    if (parsed.data.name.length < 2) return fail('Primeiro acesso: informe seu nome.', formData);
    customer = await prisma.customer.create({ data: { cpf, phone, name: parsed.data.name, referralCode: newReferralCode() } });
    // Cadastro feito pelo link "Indique amigos": registra quem indicou (o prêmio sai na primeira compra).
    await registerReferral(customer.id, String(formData.get('inviteRestaurant') ?? ''), String(formData.get('inviteCode') ?? ''));
  }
  await startCustomerSession(customer.id);

  const token = String(formData.get('token') ?? '');
  if (token) {
    try {
      const { restaurantId } = await creditClaim(token, customer.id);
      redirect(`/carteira/${restaurantId}?credited=1`);
    } catch (e) {
      if (!(e instanceof BusinessError)) throw e; // redirect() também lança — deixa passar
      return fail(e.message, formData);
    }
  }
  const inviteRestaurant = String(formData.get('inviteRestaurant') ?? '');
  if (/^[0-9a-f-]{36}$/.test(inviteRestaurant)) redirect(`/lugar/${inviteRestaurant}?bemvindo=1`);
  redirect(safeNext(formData.get('next'), '/carteira'));
}

/** Liga o cliente novo a quem o indicou. Ignora silenciosamente convites inválidos. */
async function registerReferral(referredId: string, restaurantId: string, code: string) {
  if (!/^[0-9a-f-]{36}$/.test(restaurantId) || !/^[A-Z0-9]{8}$/.test(code)) return;
  const [referrer, restaurant] = await Promise.all([
    prisma.customer.findUnique({ where: { referralCode: code }, select: { id: true } }),
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { subscriptionStatus: true, referralPoints: true } }),
  ]);
  if (!referrer || referrer.id === referredId || !restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || restaurant.referralPoints <= 0) return;
  await prisma.referral.createMany({
    data: [{ restaurantId, referrerId: referrer.id, referredId }],
    skipDuplicates: true,
  });
}

/** Cliente já logado confirma o crédito dos pontos (POST explícito: pré-visualizadores de link não creditam). */
export async function claimPoints(_: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Sua sessão expirou. Entre novamente.' };
  try {
    const { restaurantId } = await creditClaim(String(formData.get('token') ?? ''), customer.id);
    redirect(`/carteira/${restaurantId}?credited=1`);
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
    return { error: e.message };
  }
}

export async function redeemRewardAction(_: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Sua sessão expirou. Entre novamente.' };
  try {
    const redemption = await redeemReward(customer.id, String(formData.get('rewardId') ?? ''));
    revalidatePath(`/carteira/${redemption.restaurantId}`);
    return { ok: `Resgate feito! Mostre o código ${redemption.code} no balcão.` };
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
    return { error: e.message };
  }
}

export async function customerLogout() {
  await endCustomerSession();
  redirect('/entrar');
}

/** Check-in por proximidade: o navegador manda a localização e o servidor confere a distância. */
export async function checkInAction(_: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Entre na sua conta para fazer check-in.' };
  const restaurantId = String(formData.get('restaurantId') ?? '');
  try {
    const { points, bonuses } = await performCheckIn(customer.id, restaurantId, Number(formData.get('lat')), Number(formData.get('lng')));
    revalidatePath(`/lugar/${restaurantId}`);
    revalidatePath('/carteira');
    const bonus = bonuses.length ? ` + bônus do desafio (${bonuses.map((b) => `+${b.points}`).join(', ')})` : '';
    return { ok: `Check-in feito! +${points} ${points === 1 ? 'ponto' : 'pontos'}${bonus}` };
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
    return { error: e.message };
  }
}

/** Resgata a sacola inteira (vários prêmios de um mesmo lugar). */
export async function redeemBagAction(_: BagState, formData: FormData): Promise<BagState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Sua sessão expirou. Entre novamente.' };
  const restaurantId = String(formData.get('restaurantId') ?? '');

  let items: BagItem[];
  try {
    const raw = JSON.parse(String(formData.get('items') ?? '[]'));
    items = Array.isArray(raw) ? raw.map((i) => ({ rewardId: String(i.rewardId), qty: Number(i.qty) })) : [];
  } catch {
    return { error: 'Sacola inválida. Atualize a página.' };
  }

  try {
    const redemptions = await redeemItems(customer.id, restaurantId, items);
    revalidatePath(`/lugar/${restaurantId}`, 'layout');
    revalidatePath(`/carteira/${restaurantId}`);
    revalidatePath('/carteira');
    return { ok: 'Resgate realizado!', codes: redemptions.map((r) => ({ name: r.rewardName, code: r.code })) };
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
    return { error: e.message };
  }
}
