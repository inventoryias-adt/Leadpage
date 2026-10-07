import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './db';

type Kind = 'restaurant' | 'customer' | 'admin';

const COOKIE: Record<Kind, string> = { restaurant: 'rs_session', customer: 'cs_session', admin: 'ad_session' };
const MAX_AGE_S: Record<Kind, number> = { restaurant: 60 * 60 * 24 * 7, customer: 60 * 60 * 24 * 90, admin: 60 * 60 * 12 };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET ausente ou curto demais (mínimo 16 caracteres).');
  }
  return new TextEncoder().encode(s);
}

async function create(kind: Kind, id: string, maxAge = MAX_AGE_S[kind]) {
  const token = await new SignJWT({ kind })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret());

  (await cookies()).set(COOKIE[kind], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

async function read(kind: Kind): Promise<string | null> {
  const token = (await cookies()).get(COOKIE[kind])?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.kind === kind && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

async function destroy(kind: Kind) {
  (await cookies()).delete(COOKIE[kind]);
}

export const startRestaurantSession = (id: string) => create('restaurant', id);
export const startCustomerSession = (id: string) => create('customer', id);
export const endRestaurantSession = () => destroy('restaurant');
export const endCustomerSession = () => destroy('customer');
export const startAdminSession = (id: string) => create('admin', id);
export const endAdminSession = () => destroy('admin');
/** Suporte: a administração entra como o estabelecimento por no máximo 2 horas. */
export const startImpersonation = (restaurantId: string) => create('restaurant', restaurantId, 60 * 60 * 2);

// cache(): layout e página pedem a mesma sessão na mesma requisição — uma única ida ao banco.
export const getRestaurant = cache(async () => {
  const id = await read('restaurant');
  return id ? prisma.restaurant.findUnique({ where: { id } }) : null;
});

/** Administrador logado e ativo (a sessão é conferida no banco a cada requisição, então desativar corta o acesso na hora). */
export const getAdmin = cache(async () => {
  const id = await read('admin');
  if (!id) return null;
  const admin = await prisma.adminUser.findUnique({ where: { id } });
  return admin && admin.active && admin.passwordHash ? admin : null;
});

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/entrar');
  return admin;
}

export const getCustomer = cache(async () => {
  const id = await read('customer');
  return id ? prisma.customer.findUnique({ where: { id } }) : null;
});

/** Garante restaurante logado; senão manda para o login. */
export async function requireRestaurant() {
  const restaurant = await getRestaurant();
  if (!restaurant) redirect('/login');
  return restaurant;
}

/** Restaurante logado com assinatura ativa (tela de configuração/onboarding). */
export async function requirePaidRestaurant() {
  const restaurant = await requireRestaurant();
  if (restaurant.subscriptionStatus !== 'ACTIVE') redirect('/pagamento');
  return restaurant;
}

/** Assinatura ativa + onboarding concluído (telas operacionais do dia a dia). */
export async function requireActiveRestaurant() {
  const restaurant = await requirePaidRestaurant();
  if (!restaurant.onboardedAt) redirect('/dashboard/configuracoes');
  return restaurant;
}

export async function requireCustomer(next?: string) {
  const customer = await getCustomer();
  if (!customer) redirect(next ? `/entrar?next=${encodeURIComponent(next)}` : '/entrar');
  return customer;
}
