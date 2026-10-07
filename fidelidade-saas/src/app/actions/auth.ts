'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { normalizePhone } from '@/lib/br';
import { createCheckoutUrl } from '@/lib/payments';
import { endRestaurantSession, requireRestaurant, startRestaurantSession } from '@/lib/session';
import { fail, type FormState } from '@/lib/form';
import { TOO_MANY, allow, clientIp } from '@/lib/rate-limit';

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do estabelecimento.').max(80),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  phone: z.string().refine((v) => normalizePhone(v) !== null, 'Telefone inválido. Use DDD + número.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72),
});

// Hash fixo só para gastar o mesmo tempo quando o e-mail não existe (evita enumerar contas pelo tempo de resposta).
const DUMMY_HASH = '$2b$11$CwTycUXWue0Thq9StjUM0uJ8.7bK0yI9dX5mLQeG4mQ3b7fE9h8hW';

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
      passwordHash: await bcrypt.hash(password, 11),
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
  if (!(await allow(`login:ip:${ip}`, 30, 900)) || !(await allow(`login:email:${email}`, 8, 900))) {
    return fail(TOO_MANY, formData);
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, restaurant?.passwordHash ?? DUMMY_HASH);
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
