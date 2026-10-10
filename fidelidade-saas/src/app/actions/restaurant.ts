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
import { UFS, cepDigits, composeAddress } from '@/lib/address';
import { BusinessError } from '@/lib/claims';
import { saveImageFromDataUrl } from '@/lib/images';
import { downloadWithFallback } from '@/lib/product-images';
import { describeChallenge } from '@/lib/challenges';
import { applyPromos, endOfDayBR, promoBadge, startOfDayBR, parseTime } from '@/lib/promos';
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
  cep: z.string().trim().default(''),
  street: z.string().trim().min(3, 'Informe a rua ou avenida.').max(120),
  number: z.string().trim().min(1, 'Informe o número (ou S/N).').max(15),
  complement: z.string().trim().max(60).default(''),
  district: z.string().trim().max(80).default(''),
  city: z.string().trim().min(2, 'Informe a cidade.').max(80),
  state: z.string().trim().refine((v) => (UFS as readonly string[]).includes(v), 'Escolha o estado (UF).'),
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

  const cep = cepDigits(parsed.data.cep);
  if (parsed.data.cep && cep.length !== 8) return fail('CEP inválido. Use 8 números (ex.: 04204-000).', formData);

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
    address: composeAddress(parsed.data),
    cep: cep || null,
    street: parsed.data.street,
    number: parsed.data.number,
    complement: parsed.data.complement || null,
    district: parsed.data.district || null,
    city: parsed.data.city,
    state: parsed.data.state,
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
  cashValue: z.string().trim().max(20).optional().default(''), // R$ cobrado no balcão junto com os pontos (opcional)
});

/** Valor em reais digitado ("8,00") → centavos. Vazio = 0 (só pontos). */
function cashCentsFrom(input: string): number | 'invalid' {
  if (!input) return 0;
  const cents = parseMoneyToCents(input);
  return cents == null || cents > MAX_BILL_CENTS ? 'invalid' : cents;
}

/** Aceita só data URL de imagem; campo vazio = sem foto nova. */
const imageField = (formData: FormData, key: string) => {
  const v = String(formData.get(key) ?? '');
  return v.startsWith('data:image/') ? v : null;
};

/** Foto enviada do computador (data URL) ou escolhida na busca da web (URL de host permitido, baixada aqui). */
async function photoFromForm(formData: FormData): Promise<string | null> {
  const file = imageField(formData, 'imageData');
  if (file) return file;
  const web = String(formData.get('imageWebUrl') ?? '');
  if (!web) return null;
  try {
    return await downloadWithFallback(web, String(formData.get('imageWebAlt') ?? '') || undefined);
  } catch (e) {
    throw new BusinessError(e instanceof Error ? e.message : 'Não foi possível baixar a imagem.');
  }
}

export async function addReward(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = rewardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  if ((await prisma.reward.count({ where: { restaurantId: restaurant.id } })) >= 100) {
    return fail('Limite de 100 produtos atingido.', formData);
  }

  const cash = cashCentsFrom(parsed.data.cashValue);
  if (cash === 'invalid') return fail('Valor em R$ inválido. Use algo como 8,00.', formData);

  try {
    const photo = await photoFromForm(formData);
    const imageId = photo ? await saveImageFromDataUrl(restaurant.id, photo) : null;
    await prisma.reward.create({
      data: { name: parsed.data.name, description: parsed.data.description || null, pointsCost: parsed.data.pointsCost, cashCents: cash, imageId, restaurantId: restaurant.id },
    });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Produto adicionado.' };
}

/** Edita nome, pontos, valor em R$ e descrição de um produto já cadastrado. Resgates antigos mantêm o preço da época. */
export async function updateReward(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  const parsed = rewardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const cash = cashCentsFrom(parsed.data.cashValue);
  if (cash === 'invalid') return fail('Valor em R$ inválido. Use algo como 8,00.', formData);
  const reward = await prisma.reward.findFirst({ where: { id, restaurantId: restaurant.id, active: true } });
  if (!reward) return { error: 'Produto não encontrado.' };
  await prisma.reward.update({
    where: { id },
    data: { name: parsed.data.name, description: parsed.data.description || null, pointsCost: parsed.data.pointsCost, cashCents: cash },
  });
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/', 'layout');
  return { ok: 'Produto atualizado.' };
}

/** Troca a foto de um prêmio já cadastrado. */
export async function setRewardImage(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  const reward = await prisma.reward.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!reward) return { error: 'Produto não encontrado.' };
  try {
    const photo = await photoFromForm(formData);
    if (!photo) return { error: 'Escolha uma foto.' };
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
  categoryOther: z.string().trim().max(60, 'Descreva o tipo de negócio em até 60 caracteres.').default(''),
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
        categoryOther: parsed.category === 'outros' && parsed.categoryOther ? parsed.categoryOther : null,
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

// ---------------------------------------------------------------- Pontos compartilhados

/** Os dois interruptores do ecossistema: pontos daqui valem em outros lugares / aceita pontos de outros lugares. */
export async function saveSharing(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const pointsShareOut = formData.get('pointsShareOut') === 'on';
  const pointsAcceptIn = formData.get('pointsAcceptIn') === 'on';
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { pointsShareOut, pointsAcceptIn } });
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/perfil');
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

// ---------------------------------------------------------------- Campanhas de pontos

const promoSchema = z.object({
  title: z.string().trim().min(3, 'Dê um nome à campanha (ex.: Terça em dobro).').max(60),
  kind: z.enum(['MULTIPLIER', 'BONUS']),
  audience: z.enum(['ALL', 'NEW', 'INACTIVE']).default('ALL'),
  inactiveDays: z.string().default(''),
  multiplier: z.string().default(''),
  bonusPoints: z.string().default(''),
  minAmount: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  startTime: z.string().default(''),
  endTime: z.string().default(''),
});

export async function addPromotion(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = promoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const d = parsed.data;

  let multiplier: number | null = null;
  let bonusPoints: number | null = null;
  if (d.kind === 'MULTIPLIER') {
    multiplier = Number(d.multiplier.replace(',', '.'));
    if (!Number.isFinite(multiplier) || multiplier < 1.1 || multiplier > 10) return fail('O multiplicador deve ficar entre 1,1x e 10x.', formData);
    multiplier = Math.round(multiplier * 100) / 100;
  } else {
    bonusPoints = Number(d.bonusPoints);
    if (!Number.isInteger(bonusPoints) || bonusPoints < 1 || bonusPoints > 100_000) return fail('Informe os pontos extras (número inteiro, a partir de 1).', formData);
  }

  let inactiveDays: number | null = null;
  if (d.audience === 'INACTIVE') {
    inactiveDays = Number(d.inactiveDays);
    if (!Number.isInteger(inactiveDays) || inactiveDays < 7 || inactiveDays > 365) return fail('Informe há quantos dias o cliente não compra (de 7 a 365).', formData);
  }

  let minAmountCents = 0;
  if (d.minAmount.trim()) {
    const cents = parseMoneyToCents(d.minAmount);
    if (cents === null || cents > MAX_BILL_CENTS) return fail('Valor mínimo inválido. Exemplo: 40,00', formData);
    minAmountCents = cents;
  }

  const startsAt = d.startDate ? startOfDayBR(d.startDate) : null;
  const endsAt = d.endDate ? endOfDayBR(d.endDate) : null;
  if ((d.startDate && !startsAt) || (d.endDate && !endsAt)) return fail('Data inválida.', formData);
  if (startsAt && endsAt && endsAt <= startsAt) return fail('A data final precisa ser igual ou depois da inicial.', formData);
  if (endsAt && endsAt.getTime() <= Date.now()) return fail('A data final já passou.', formData);

  if ((d.startTime && parseTime(d.startTime) == null) || (d.endTime && parseTime(d.endTime) == null)) return fail('Horário inválido.', formData);
  if (d.startTime && d.endTime && d.startTime === d.endTime) return fail('O horário inicial e o final não podem ser iguais.', formData);

  const weekdays = [...new Set(formData.getAll('weekdays').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();

  if ((await prisma.promotion.count({ where: { restaurantId: restaurant.id } })) >= 20) return fail('Limite de 20 campanhas atingido. Remova alguma antiga.', formData);

  await prisma.promotion.create({
    data: {
      restaurantId: restaurant.id,
      title: d.title,
      kind: d.kind,
      audience: d.audience,
      inactiveDays,
      multiplier,
      bonusPoints,
      minAmountCents,
      startsAt,
      endsAt,
      weekdays: weekdays.length === 7 ? [] : weekdays,
      startTime: d.startTime || null,
      endTime: d.endTime || null,
    },
  });
  revalidatePath('/dashboard', 'layout');
  return { ok: 'Campanha criada.' };
}

export async function removePromotion(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  await prisma.promotion.deleteMany({ where: { id: String(formData.get('id')), restaurantId: restaurant.id } });
  revalidatePath('/dashboard', 'layout');
}

export async function togglePromotion(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  const promo = await prisma.promotion.findFirst({ where: { id: String(formData.get('id')), restaurantId: restaurant.id } });
  if (!promo) return;
  await prisma.promotion.update({ where: { id: promo.id }, data: { active: !promo.active } });
  revalidatePath('/dashboard', 'layout');
}

// ---------------------------------------------------------------- Guia inicial

/** Dispensa (ou conclui) o passo a passo inicial: ele para de abrir sozinho. */
export async function finishGuide() {
  const restaurant = await requirePaidRestaurant();
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { guideDoneAt: new Date() } });
  revalidatePath('/dashboard', 'layout');
}

// ---------------------------------------------------------------- Caixa

export type CaixaState = {
  error?: string;
  claim?: { url: string; points: number; amountCents: number; description: string; createdAt: string; expiresAt: string; phone?: string };
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
  // Campanhas valendo agora (multiplicador / pontos extras) incidem só sobre a parte da conta, não sobre as interações.
  // Campanhas para um público específico (primeira compra, quem sumiu) só são aplicadas quando o cliente lê o QR,
  // porque só então sabemos quem ele é (ver creditClaim).
  const promos = await prisma.promotion.findMany({ where: { restaurantId: restaurant.id, active: true, audience: 'ALL' } });
  const billPoints = calculatePoints(amountCents, restaurant.pointsPerReal);
  const promoResult = applyPromos(billPoints, amountCents, promos);
  const points = promoResult.points + interactions.reduce((n, i) => n + i.points, 0);
  if (points <= 0) return { error: 'Informe o valor da conta ou marque ao menos uma interação.' };

  const promoNote = promoResult.applied.length ? ` (${promoResult.applied.map((p) => `${promoBadge(p)} · ${p.title}`).join(' + ')})` : '';
  const parts = [amountCents > 0 ? `Compra de ${formatBRL(amountCents)}${promoNote}` : null, ...interactions.map((i) => i.label)];
  const description = parts.filter(Boolean).join(' + ');
  const expiresAt = new Date(Date.now() + CLAIM_TTL_HOURS * 60 * 60 * 1000);
  const token = newClaimToken();
  const { unit } = await currentUnit(restaurant.id);

  await prisma.claim.create({
    data: { token, restaurantId: restaurant.id, unitId: unit?.id ?? null, amountCents, points, billPoints, description, expiresAt },
  });
  // Sem revalidatePath aqui: o QR Code aparece na hora e a lista de lançamentos atualiza em segundo plano (router.refresh no cliente).
  return {
    claim: {
      url: `${appUrl()}/r/${token}`,
      points,
      amountCents,
      description,
      createdAt: new Date().toISOString(),
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
