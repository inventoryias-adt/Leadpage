'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { isValidCpf, normalizePhone, onlyDigits } from '@/lib/br';
import { BusinessError, creditClaim, redeemReward } from '@/lib/claims';
import { endCustomerSession, getCustomer, startCustomerSession } from '@/lib/session';
import { fail, safeNext, type FormState } from '@/lib/form';
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
    customer = await prisma.customer.create({ data: { cpf, phone, name: parsed.data.name } });
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
  redirect(safeNext(formData.get('next'), '/carteira'));
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
