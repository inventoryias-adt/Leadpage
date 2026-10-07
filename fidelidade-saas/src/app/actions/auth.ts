'use server';

import { dummyHash, hashPassword, verifyPassword } from '@/lib/password';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { normalizePhone } from '@/lib/br';
import { createCheckoutUrl } from '@/lib/payments';
import { endRestaurantSession, requireRestaurant, startRestaurantSession } from '@/lib/session';
import { fail, type FormState } from '@/lib/form';
import { DEFAULT_UNIT_NAME } from '@/lib/units';
import { TOO_MANY, allow, clientIp } from '@/lib/rate-limit';

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do estabelecimento.').max(80),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  phone: z.string().refine((v) => normalizePhone(v) !== null, 'Telefone inválido. Use DDD + número.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72),
});

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);
  const { name, email, phone, password } = parsed.data;

  if (!(await allow(`signup:${await clientIp()}`, 10, 3600))) return fail(TOO_MANY, formData);

  if (await prisma.restaurant.findUnique({ where: { email } })) {
    return fail('Este e-mail já está cadastrado. Entre na sua conta.', formData);
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      email,
      phone: normalizePhone(phone)!,
      passwordHash: await hashPassword(password),
      // Toda marca começa com uma unidade; o dono completa endereço e horário no onboarding.
      units: { create: { name: DEFAULT_UNIT_NAME } },
      // Sugestões iniciais de interação — o dono ajusta no onboarding.
      interactionRules: {
        create: [
          { label: 'Foto no Instagram marcando o restaurante', points: 50 },
          { label: 'Avaliação 5 estrelas no Google', points: 100 },
        ],
      },
    },
  });

  await startRestaurantSession(restaurant.id);
  redirect(await createCheckoutUrl(restaurant));
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  // Limita por IP e por e-mail (a conta alvo), para barrar força bruta e credential stuffing.
  const ip = await clientIp();
  const [okIp, okEmail] = await Promise.all([allow(`login:ip:${ip}`, 30, 900), allow(`login:email:${email}`, 8, 900)]);
  if (!okIp || !okEmail) return fail(TOO_MANY, formData);

  const restaurant = await prisma.restaurant.findUnique({ where: { email } });
  const ok = await verifyPassword(password, restaurant?.passwordHash ?? (await dummyHash()));
  if (!restaurant || !ok) return fail('E-mail ou senha incorretos.', formData);

  await startRestaurantSession(restaurant.id);
  redirect('/dashboard');
}

export async function logout() {
  await endRestaurantSession();
  redirect('/login');
}

/** Reenvia o restaurante pendente para o pagamento. */
export async function startCheckout() {
  const restaurant = await requireRestaurant();
  redirect(await createCheckoutUrl(restaurant));
}

const passwordChangeSchema = z.object({
  current: z.string().min(1, 'Informe a senha atual.'),
  next: z.string().min(8, 'A nova senha precisa ter pelo menos 8 caracteres.').max(72),
  confirm: z.string(),
});

/** O dono troca a própria senha (necessário depois de uma senha temporária da administração). */
export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requireRestaurant();
  const parsed = passwordChangeSchema.safeParse({ current: formData.get('current') ?? '', next: formData.get('next') ?? '', confirm: formData.get('confirm') ?? '' });
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);
  if (parsed.data.next !== parsed.data.confirm) return fail('As senhas novas não são iguais.', formData);
  if (!(await allow(`pwchange:${restaurant.id}`, 6, 900))) return fail(TOO_MANY, formData);
  if (!(await verifyPassword(parsed.data.current, restaurant.passwordHash))) return fail('A senha atual está incorreta.', formData);
  if (parsed.data.current === parsed.data.next) return fail('A nova senha precisa ser diferente da atual.', formData);
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  return { ok: 'Senha alterada.' };
}
