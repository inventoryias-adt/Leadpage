'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { appUrl } from '@/lib/payments';
import { requireActiveRestaurant, requirePaidRestaurant } from '@/lib/session';
import { MAX_BILL_CENTS, CLAIM_TTL_HOURS, calculatePoints, formatBRL, parseMoneyToCents } from '@/lib/points';
import { newClaimToken } from '@/lib/tokens';
import { parseSchedule, scheduleSchema } from '@/lib/hours';
import { isCategory } from '@/lib/categories';
import { validCoords } from '@/lib/geo';
import { BusinessError } from '@/lib/claims';
import { saveImageFromDataUrl } from '@/lib/images';
import { describeChallenge } from '@/lib/challenges';
import { fail, type FormState } from '@/lib/form';
import { cookies } from 'next/headers';
import { UNIT_COOKIE, currentUnit } from '@/lib/units';

const firstIssue = (e: z.ZodError) => e.issues[0].message;

// ---------------------------------------------------------------- Onboarding / configurações

const basicsSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do estabelecimento.').max(80),
});

export async function saveBasics(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = basicsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);

  await prisma.restaurant.update({ where: { id: restaurant.id }, data: parsed.data });
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Dados salvos.' };
}

// ---------------------------------------------------------------- Unidades

const unitSchema = z.object({
  name: z.string().trim().min(2, 'Dê um nome à unidade (ex.: Centro, Shopping Norte).').max(60),
  address: z.string().trim().min(8, 'Informe o endereço completo (rua, número, bairro e cidade).').max(200),
  googleReviewUrl: z.string().trim().default(''),
  latitude: z.string().trim().default(''),
  longitude: z.string().trim().default(''),
});

/** Cria ou atualiza uma unidade. O formulário envia os horários como JSON em `schedule`. */
export async function saveUnit(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');

  const parsed = unitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('schedule') ?? ''));
  } catch {
    return fail('Horários inválidos. Recarregue a página e tente de novo.', formData);
  }
  const schedule = scheduleSchema.safeParse(raw);
  if (!schedule.success) return fail(firstIssue(schedule.error), formData);

  const review = normalizeGoogleReview(parsed.data.googleReviewUrl);
  if (review === 'invalid') {
    return fail('Link do Google inválido. Cole o link de avaliação do Google Meu Negócio (ou o Place ID).', formData);
  }

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (parsed.data.latitude || parsed.data.longitude) {
    latitude = Number(parsed.data.latitude.replace(',', '.'));
    longitude = Number(parsed.data.longitude.replace(',', '.'));
    if (!validCoords(latitude, longitude)) return fail('Localização inválida. Use o botão "Usar minha localização atual".', formData);
  }

  const data = {
    name: parsed.data.name,
    address: parsed.data.address,
    openingSchedule: schedule.data,
    googleReviewUrl: review,
    latitude,
    longitude,
    active: formData.get('active') === 'on' || !id, // unidade nova já nasce ativa
  };

  if (id) {
    const unit = await prisma.unit.findFirst({ where: { id, restaurantId: restaurant.id } });
    if (!unit) return { error: 'Unidade não encontrada.' };
    if (!data.active && unit.active && (await prisma.unit.count({ where: { restaurantId: restaurant.id, active: true } })) <= 1) {
      return fail('A marca precisa ter pelo menos uma unidade ativa.', formData);
    }
    await prisma.unit.update({ where: { id }, data });
  } else {
    if ((await prisma.unit.count({ where: { restaurantId: restaurant.id } })) >= 30) return fail('Limite de 30 unidades atingido.', formData);
    await prisma.unit.create({ data: { ...data, restaurantId: restaurant.id } });
  }
  revalidatePath('/dashboard', 'layout');
  return { ok: id ? 'Unidade salva.' : 'Unidade adicionada.' };
}

/** Remove a unidade; se ela já tem histórico (lançamentos, check-ins ou entregas), apenas a desativa. */
export async function removeUnit(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  const unit = await prisma.unit.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!unit) return;
  const activeCount = await prisma.unit.count({ where: { restaurantId: restaurant.id, active: true } });
  if (unit.active && activeCount <= 1) return; // nunca fica sem unidade ativa

  const [claims, checkIns, deliveries] = await Promise.all([
    prisma.claim.count({ where: { unitId: id } }),
    prisma.checkIn.count({ where: { unitId: id } }),
    prisma.redemption.count({ where: { usedUnitId: id } }),
  ]);
  if (claims + checkIns + deliveries > 0) await prisma.unit.update({ where: { id }, data: { active: false } });
  else await prisma.unit.delete({ where: { id } });
  revalidatePath('/dashboard', 'layout');
}

/** Escolhe em qual unidade este aparelho (caixa) está operando. */
export async function setCurrentUnitAction(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('unitId') ?? '');
  const unit = await prisma.unit.findFirst({ where: { id, restaurantId: restaurant.id, active: true }, select: { id: true } });
  if (!unit) return;
  (await cookies()).set(UNIT_COOKIE, unit.id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === 'production' });
  revalidatePath('/dashboard', 'layout');
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
  description: z.string().trim().max(160).optional().default(''),
  pointsCost: z.coerce.number().int('Use um número inteiro.').min(1, 'Mínimo de 1 ponto.').max(10_000_000),
});

/** Aceita só data URL de imagem; campo vazio = sem foto nova. */
const imageField = (formData: FormData, key: string) => {
  const v = String(formData.get(key) ?? '');
  return v.startsWith('data:image/') ? v : null;
};

export async function addReward(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = rewardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  if ((await prisma.reward.count({ where: { restaurantId: restaurant.id } })) >= 100) {
    return fail('Limite de 100 produtos atingido.', formData);
  }

  try {
    const photo = imageField(formData, 'imageData');
    const imageId = photo ? await saveImageFromDataUrl(restaurant.id, photo) : null;
    await prisma.reward.create({
      data: { name: parsed.data.name, description: parsed.data.description || null, pointsCost: parsed.data.pointsCost, imageId, restaurantId: restaurant.id },
    });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Produto adicionado.' };
}

/** Troca a foto de um prêmio já cadastrado. */
export async function setRewardImage(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  const reward = await prisma.reward.findFirst({ where: { id, restaurantId: restaurant.id } });
  const photo = imageField(formData, 'imageData');
  if (!reward || !photo) return { error: 'Escolha uma foto.' };
  try {
    const imageId = await saveImageFromDataUrl(restaurant.id, photo, reward.imageId);
    await prisma.reward.update({ where: { id }, data: { imageId } });
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    throw e;
  }
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Foto atualizada.' };
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
  const units = await prisma.unit.findMany({ where: { restaurantId: restaurant.id, active: true } });
  if (units.length === 0) return { error: 'Cadastre ao menos uma unidade.' };
  if (!units.some((u) => u.address && parseSchedule(u.openingSchedule))) {
    return { error: 'Preencha e salve o endereço e os horários de funcionamento da unidade.' };
  }
  if (!(await prisma.reward.count({ where: { restaurantId: restaurant.id, active: true } }))) {
    return { error: 'Cadastre pelo menos um produto resgatável para seus clientes.' };
  }
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { onboardedAt: new Date() } });
  redirect('/dashboard/caixa');
}

// ---------------------------------------------------------------- Identidade, localização e vitrine

const identitySchema = z.object({
  category: z.string().trim().default(''),
  instagram: z.string().trim().default(''),
});

/** Aceita o link de avaliação do Google ou só o Place ID (ChIJ…), e devolve o link final. */
function normalizeGoogleReview(input: string): string | null | 'invalid' {
  if (!input) return null;
  if (/^ChIJ[\w-]{10,}$/.test(input)) return `https://search.google.com/local/writereview?placeid=${input}`;
  try {
    const url = new URL(input);
    const host = url.hostname;
    const ok = url.protocol === 'https:' && (/(^|\.)google\.[a-z.]+$/.test(host) || host === 'g.page' || host === 'goo.gl' || host === 'maps.app.goo.gl' || host === 'g.co');
    return ok ? url.toString() : 'invalid';
  } catch {
    return 'invalid';
  }
}

export async function saveIdentity(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = identitySchema.parse(Object.fromEntries(formData));

  if (parsed.category && !isCategory(parsed.category)) return fail('Categoria inválida.', formData);

  const instagram = parsed.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) return fail('Instagram inválido. Use só o @ do perfil (ex.: burgerdoze).', formData);

  try {
    const logo = imageField(formData, 'logoData');
    const cover = imageField(formData, 'coverData');
    const logoImageId = logo ? await saveImageFromDataUrl(restaurant.id, logo, restaurant.logoImageId) : restaurant.logoImageId;
    const coverImageId = cover ? await saveImageFromDataUrl(restaurant.id, cover, restaurant.coverImageId) : restaurant.coverImageId;

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        category: parsed.category || null,
        instagram: instagram || null,
        listed: formData.get('listed') === 'on',
        logoImageId,
        coverImageId,
      },
    });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Identidade da marca salva.' };
}

const engagementSchema = z.object({
  checkInPoints: z.coerce.number().int('Use um número inteiro.').min(0).max(10_000),
  referralPoints: z.coerce.number().int('Use um número inteiro.').min(0).max(100_000),
});

export async function saveEngagement(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = engagementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: parsed.data });
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Salvo.' };
}

// ---------------------------------------------------------------- Desafios

const challengeSchema = z.object({
  kind: z.enum(['PURCHASES', 'CHECKINS']),
  period: z.enum(['WEEK', 'MONTH']),
  target: z.coerce.number().int('Use um número inteiro.').min(1, 'A meta mínima é 1.').max(60),
  minAmount: z.string().default(''),
  bonusPoints: z.coerce.number().int('Use um número inteiro.').min(1, 'Informe os pontos de bônus.').max(100_000),
});

export async function addChallenge(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = challengeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const { kind, period, target, bonusPoints } = parsed.data;

  let minAmountCents = 0;
  if (kind === 'PURCHASES' && parsed.data.minAmount.trim()) {
    const cents = parseMoneyToCents(parsed.data.minAmount);
    if (cents === null || cents > MAX_BILL_CENTS) return fail('Valor mínimo inválido. Exemplo: 42,00', formData);
    minAmountCents = cents;
  }
  if ((await prisma.challenge.count({ where: { restaurantId: restaurant.id } })) >= 10) {
    return fail('Limite de 10 desafios atingido.', formData);
  }

  const title = describeChallenge({ kind, target, minAmountCents, period });
  await prisma.challenge.create({
    data: { restaurantId: restaurant.id, title, kind, period, target, minAmountCents, bonusPoints },
  });
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Desafio criado.' };
}

export async function removeChallenge(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  await prisma.challenge.deleteMany({ where: { id: String(formData.get('id')), restaurantId: restaurant.id } });
  revalidatePath('/dashboard', 'layout');
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
  const { unit } = await currentUnit(restaurant.id);

  await prisma.claim.create({
    data: { token, restaurantId: restaurant.id, unitId: unit?.id ?? null, amountCents, points, description, expiresAt },
  });
  // Sem revalidatePath aqui: o QR Code aparece na hora e a lista de lançamentos atualiza em segundo plano (router.refresh no cliente).
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
  const { unit } = await currentUnit(restaurant.id);
  await prisma.redemption.updateMany({
    where: { id: String(formData.get('id')), restaurantId: restaurant.id, status: 'PENDING' },
    data: { status: 'USED', usedAt: new Date(), usedUnitId: unit?.id ?? null },
  });
  revalidatePath('/dashboard/resgates');
  revalidatePath('/dashboard');
}
