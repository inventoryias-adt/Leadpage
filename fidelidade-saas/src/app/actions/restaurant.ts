'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { appUrl } from '@/lib/payments';
import { requireActiveRestaurant, requirePaidRestaurant } from '@/lib/session';
import { MAX_BILL_CENTS, CLAIM_TTL_HOURS, calculatePoints, formatBRL, parseMoneyToCents } from '@/lib/points';
import { newClaimToken } from '@/lib/tokens';
import { fail, type FormState } from '@/lib/form';

const firstIssue = (e: z.ZodError) => e.issues[0].message;

// ---------------------------------------------------------------- Onboarding / configurações

const basicsSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do estabelecimento.').max(80),
  address: z.string().trim().min(8, 'Informe o endereço completo (rua, número, bairro e cidade).').max(200),
  openingHours: z.string().trim().min(3, 'Informe o horário de funcionamento.').max(200),
});

export async function saveBasics(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = basicsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);

  await prisma.restaurant.update({ where: { id: restaurant.id }, data: parsed.data });
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Dados salvos.' };
}

const rulesSchema = z.object({
  pointsPerReal: z.coerce.number().int('Use um número inteiro.').min(1, 'Mínimo de 1 ponto por real.').max(1000),
  maxRedeemsPerMonth: z.coerce.number().int('Use um número inteiro.').min(1, 'Mínimo de 1 resgate.').max(100),
});

export async function saveRules(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = rulesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);

  await prisma.restaurant.update({ where: { id: restaurant.id }, data: parsed.data });
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Regras salvas.' };
}

const interactionSchema = z.object({
  label: z.string().trim().min(2, 'Descreva a interação.').max(80),
  points: z.coerce.number().int('Use um número inteiro.').min(1, 'Mínimo de 1 ponto.').max(100_000),
});

export async function addInteraction(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = interactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  if ((await prisma.interactionRule.count({ where: { restaurantId: restaurant.id } })) >= 20) {
    return fail('Limite de 20 interações atingido.', formData);
  }

  await prisma.interactionRule.create({ data: { ...parsed.data, restaurantId: restaurant.id } });
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Interação adicionada.' };
}

export async function removeInteraction(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  await prisma.interactionRule.deleteMany({
    where: { id: String(formData.get('id')), restaurantId: restaurant.id },
  });
  revalidatePath('/dashboard', 'layout');
}

const rewardSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do produto.').max(80),
  pointsCost: z.coerce.number().int('Use um número inteiro.').min(1, 'Mínimo de 1 ponto.').max(10_000_000),
});

export async function addReward(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = rewardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  if ((await prisma.reward.count({ where: { restaurantId: restaurant.id } })) >= 100) {
    return fail('Limite de 100 produtos atingido.', formData);
  }

  await prisma.reward.create({ data: { ...parsed.data, restaurantId: restaurant.id } });
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Produto adicionado.' };
}

/** Prêmios já resgatados não podem ser apagados (histórico) — apenas desativados. */
export async function removeReward(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id'));
  const where = { id, restaurantId: restaurant.id };
  if (await prisma.redemption.count({ where: { rewardId: id } })) {
    await prisma.reward.updateMany({ where, data: { active: false } });
  } else {
    await prisma.reward.deleteMany({ where });
  }
  revalidatePath('/dashboard', 'layout');
}

export async function finishOnboarding(_: FormState, __: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  if (!restaurant.address || !restaurant.openingHours) {
    return { error: 'Preencha e salve os dados do estabelecimento (endereço e horário).' };
  }
  if (!(await prisma.reward.count({ where: { restaurantId: restaurant.id, active: true } }))) {
    return { error: 'Cadastre pelo menos um produto resgatável para seus clientes.' };
  }
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { onboardedAt: new Date() } });
  redirect('/dashboard/caixa');
}

// ---------------------------------------------------------------- Caixa

export type CaixaState = {
  error?: string;
  claim?: { url: string; points: number; description: string; expiresAt: string; phone?: string };
};

const caixaSchema = z.object({
  amount: z.string().default(''),
  phone: z.string().default(''),
});

export async function createClaim(_: CaixaState, formData: FormData): Promise<CaixaState> {
  const restaurant = await requireActiveRestaurant();
  const parsed = caixaSchema.parse({
    amount: formData.get('amount') ?? '',
    phone: formData.get('phone') ?? '',
  });

  const amountCents = parsed.amount.trim() ? parseMoneyToCents(parsed.amount) : 0;
  if (amountCents === null) return { error: 'Valor inválido. Exemplo: 150,00' };
  if (amountCents > MAX_BILL_CENTS) return { error: 'Valor acima do limite permitido por lançamento.' };

  const ids = formData.getAll('interaction').map(String);
  const interactions = ids.length
    ? await prisma.interactionRule.findMany({
        where: { id: { in: ids }, restaurantId: restaurant.id, active: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  // Os pontos são calculados aqui, com as regras gravadas no banco — nada vem do cliente.
  const points = calculatePoints(amountCents, restaurant.pointsPerReal, interactions);
  if (points <= 0) return { error: 'Informe o valor da conta ou marque ao menos uma interação.' };

  const parts = [amountCents > 0 ? `Compra de ${formatBRL(amountCents)}` : null, ...interactions.map((i) => i.label)];
  const description = parts.filter(Boolean).join(' + ');
  const expiresAt = new Date(Date.now() + CLAIM_TTL_HOURS * 60 * 60 * 1000);
  const token = newClaimToken();

  await prisma.claim.create({
    data: { token, restaurantId: restaurant.id, amountCents, points, description, expiresAt },
  });
  revalidatePath('/dashboard/caixa');

  return {
    claim: {
      url: `${appUrl()}/r/${token}`,
      points,
      description,
      expiresAt: expiresAt.toISOString(),
      phone: parsed.phone || undefined,
    },
  };
}

// ---------------------------------------------------------------- Validação de resgates no balcão

export async function markRedemptionUsed(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  await prisma.redemption.updateMany({
    where: { id: String(formData.get('id')), restaurantId: restaurant.id, status: 'PENDING' },
    data: { status: 'USED', usedAt: new Date() },
  });
  revalidatePath('/dashboard/resgates');
  revalidatePath('/dashboard');
}
