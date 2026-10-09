'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { isValidCpf, normalizePhone, onlyDigits } from '@/lib/br';
import { BusinessError, creditClaim, performCheckIn, redeemItems, redeemReward, type BagItem } from '@/lib/claims';
import { emailConfigured } from '@/lib/mailer';
import { dummyHash, hashPassword, verifyPassword } from '@/lib/password';
import { newReferralCode } from '@/lib/tokens';
import { endCustomerSession, getCustomer, startCustomerSession } from '@/lib/session';
import { fail, safeNext, type BagState, type FormState } from '@/lib/form';
import { TOO_MANY, allow, clientIp } from '@/lib/rate-limit';

const emailField = z.string().trim().toLowerCase().email('E-mail inválido.').max(120);
const passwordField = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72, 'A senha pode ter no máximo 72 caracteres.');
const cpfField = z.string().refine(isValidCpf, 'CPF inválido.');
const phoneField = z.string().refine((v) => normalizePhone(v) !== null, 'Telefone inválido. Use DDD + número.');

const loginSchema = z.object({ email: emailField, password: z.string().min(1, 'Informe a senha.') });
const signupSchema = z.object({ name: z.string().trim().min(2, 'Informe seu nome.').max(80), cpf: cpfField, phone: phoneField, email: emailField, password: passwordField });
const recoverSchema = z.object({ cpf: cpfField, phone: phoneField, email: emailField, password: passwordField });

const BAD_LOGIN = 'E-mail ou senha incorretos.';

/**
 * Depois de autenticar: com `token` já credita o QR Code; com convite leva ao lugar; senão vai para `next`.
 * (redirect() lança — o catch só trata erros de negócio.)
 */
async function finishLogin(customerId: string, formData: FormData): Promise<FormState> {
  await startCustomerSession(customerId);
  const token = String(formData.get('token') ?? '');
  if (token) {
    try {
      const { restaurantId } = await creditClaim(token, customerId);
      redirect(`/carteira/${restaurantId}?credited=1`);
    } catch (e) {
      if (!(e instanceof BusinessError)) throw e;
      return fail(e.message, formData);
    }
  }
  const inviteRestaurant = String(formData.get('inviteRestaurant') ?? '');
  if (/^[0-9a-f-]{36}$/.test(inviteRestaurant)) redirect(`/lugar/${inviteRestaurant}?bemvindo=1`);
  redirect(safeNext(formData.get('next'), '/carteira'));
}

/** Entrada de quem já tem acesso: só e-mail e senha. */
export async function customerLogin(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get('email') ?? '', password: formData.get('password') ?? '' });
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);
  const { email, password } = parsed.data;

  const ip = await clientIp();
  const [okIp, okEmail] = await Promise.all([allow(`cust:ip:${ip}`, 30, 900), allow(`cust:email:${email}`, 8, 900)]);
  if (!okIp || !okEmail) return fail(TOO_MANY, formData);

  const customer = await prisma.customer.findUnique({ where: { email } });
  const ok = await verifyPassword(password, customer?.passwordHash ?? (await dummyHash()));
  if (!customer || !customer.passwordHash || !ok) return fail(BAD_LOGIN, formData);
  return finishLogin(customer.id, formData);
}

/** Conta nova: nome, CPF, telefone, e-mail e senha. O CPF segue sendo a identidade (limite de resgates por mês). */
export async function customerSignup(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get('name') ?? '',
    cpf: formData.get('cpf') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    password: formData.get('password') ?? '',
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);
  const { name, email, password } = parsed.data;
  const cpf = onlyDigits(parsed.data.cpf);
  const phone = normalizePhone(parsed.data.phone)!;

  const ip = await clientIp();
  const [okIp, okCpf] = await Promise.all([allow(`cust:ip:${ip}`, 30, 900), allow(`cust:cpf:${cpf}`, 8, 900)]);
  if (!okIp || !okCpf) return fail(TOO_MANY, formData);

  const [byCpf, byEmail] = await Promise.all([prisma.customer.findUnique({ where: { cpf }, select: { id: true } }), prisma.customer.findUnique({ where: { email }, select: { id: true } })]);
  if (byCpf) return fail('Este CPF já tem cadastro. Use “Já tenho cadastro” para criar seu acesso com e-mail e senha.', formData);
  if (byEmail) return fail('Este e-mail já está em uso. Entre com ele ou use outro.', formData);

  const customer = await prisma.customer
    .create({ data: { cpf, phone, name, email, passwordHash: await hashPassword(password), referralCode: newReferralCode() } })
    .catch((e: { code?: string }) => (e.code === 'P2002' ? null : Promise.reject(e))); // corrida: outro cadastro igual no mesmo instante
  if (!customer) return fail('Este CPF ou e-mail já tem cadastro. Tente entrar.', formData);
  // Cadastro feito pelo link "Indique amigos": registra quem indicou (o prêmio sai na primeira compra).
  await registerReferral(customer.id, String(formData.get('inviteRestaurant') ?? ''), String(formData.get('inviteCode') ?? ''));
  return finishLogin(customer.id, formData);
}

/**
 * Quem já tinha cadastro (CPF + telefone) cria o acesso com e-mail e senha — e também serve para redefinir
 * uma senha esquecida. A prova de identidade é a mesma de antes (CPF + telefone cadastrados).
 */
export async function customerRecover(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = recoverSchema.safeParse({
    cpf: formData.get('cpf') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    password: formData.get('password') ?? '',
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);
  const { email, password } = parsed.data;
  const cpf = onlyDigits(parsed.data.cpf);
  const phone = normalizePhone(parsed.data.phone)!;

  const ip = await clientIp();
  const [okIp, okCpf] = await Promise.all([allow(`cust:ip:${ip}`, 30, 900), allow(`cust:cpf:${cpf}`, 8, 900)]);
  if (!okIp || !okCpf) return fail(TOO_MANY, formData);

  const customer = await prisma.customer.findUnique({ where: { cpf } });
  if (!customer) return fail('Não encontramos cadastro com este CPF. Use “Criar conta”.', formData);
  // Quem já tem senha e pode receber e-mail redefine por e-mail: CPF + telefone sozinhos não bastam para trocar uma senha.
  if (customer.passwordHash && emailConfigured()) return fail('Esta conta já tem senha. Use “Esqueci minha senha” para receber um link por e-mail.', formData);
  if (customer.phone !== phone) return fail('O telefone não confere com o cadastrado para este CPF.', formData);
  const taken = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
  if (taken && taken.id !== customer.id) return fail('Este e-mail já está em uso por outra conta.', formData);

  await prisma.customer.update({ where: { id: customer.id }, data: { email, passwordHash: await hashPassword(password) } });
  return finishLogin(customer.id, formData);
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
