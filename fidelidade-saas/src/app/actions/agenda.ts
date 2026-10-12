'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, type FormState } from '@/lib/form';
import { normalizePhone } from '@/lib/br';
import { scheduleSchema } from '@/lib/hours';
import { saveImageFromDataUrl } from '@/lib/images';
import { parseMoneyToCents } from '@/lib/points';
import { redirect } from 'next/navigation';
import { cancelByOwner, completeBooking, confirmBooking, markNoShow } from '@/lib/booking-db';
import { BusinessError } from '@/lib/claims';
import { requireActiveRestaurant, requirePaidRestaurant } from '@/lib/session';

const firstIssue = (e: z.ZodError) => e.issues[0].message;
const refresh = () => revalidatePath('/dashboard', 'layout');

// ---------------------------------------------------------------- Regras de agendamento

const policySchema = z.object({
  bookingMinNoticeMin: z.coerce.number().int().min(0).max(7 * 24 * 60),
  bookingMaxDaysAhead: z.coerce.number().int().min(1).max(180),
  bookingCancelHours: z.coerce.number().int().min(0).max(14 * 24),
  pointsPerRealOff: z.coerce.number().int().min(10, 'Use ao menos 10 pontos por R$ 1,00 de desconto.').max(10_000),
  bookingNotifyEmail: z.string().trim().toLowerCase().max(120).default(''),
});

export async function saveBookingPolicy(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = policySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message.startsWith('Use ao menos') ? parsed.error.issues[0].message : 'Confira os números das regras de agendamento.', formData);
  const { bookingNotifyEmail, ...rest } = parsed.data;
  if (bookingNotifyEmail && !z.string().email().safeParse(bookingNotifyEmail).success) return fail('E-mail de aviso inválido.', formData);
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { ...rest, bookingNotifyEmail: bookingNotifyEmail || null, bookingAutoConfirm: formData.get('bookingAutoConfirm') === 'on' },
  });
  refresh();
  return { ok: 'Regras de agendamento salvas.' };
}

// ---------------------------------------------------------------- Equipe e vagas

const staffSchema = z.object({
  id: z.string().default(''),
  name: z.string().trim().min(2, 'Informe o nome (ex.: João, Sala 1, Mesas).').max(40),
  capacity: z.coerce.number().int('Use um número inteiro.').min(1, 'No mínimo 1 atendimento por vez.').max(60, 'No máximo 60 ao mesmo tempo.'),
  unitId: z.string().default(''),
  email: z.string().trim().toLowerCase().max(120).default(''),
  phone: z.string().default(''),
});

/** Cria ou atualiza um profissional (ou vaga): foto, contato, escala, serviços que faz e o tempo de cada um. */
export async function saveResource(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = staffSchema.safeParse({
    id: formData.get('id') ?? '',
    name: formData.get('name') ?? '',
    capacity: formData.get('capacity') ?? '1',
    unitId: formData.get('unitId') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
  });
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const d = parsed.data;

  const existing = d.id ? await prisma.resource.findFirst({ where: { id: d.id, restaurantId: restaurant.id } }) : null;
  if (d.id && !existing) return fail('Profissional não encontrado.', formData);
  if (d.email && !z.string().email().safeParse(d.email).success) return fail('E-mail inválido.', formData);
  const phone = d.phone.trim() ? normalizePhone(d.phone) : null;
  if (d.phone.trim() && !phone) return fail('WhatsApp inválido. Use DDD + número.', formData);

  let unitId: string | null = null;
  if (d.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: d.unitId, restaurantId: restaurant.id, active: true }, select: { id: true } });
    if (!unit) return fail('Unidade não encontrada.', formData);
    unitId = unit.id;
  }

  // Escala: "segue a unidade" (vazio) ou os 7 dias com horários próprios.
  let schedule: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  if (formData.get('followUnit') !== 'on') {
    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get('schedule') ?? ''));
    } catch {
      return fail('Confira os dias e horários de trabalho.', formData);
    }
    const sch = scheduleSchema.safeParse(raw);
    if (!sch.success) return fail(sch.error.issues[0].message, formData);
    schedule = sch.data;
  }

  // Serviços que faz e quanto tempo leva com ele (vazio = a duração padrão do serviço).
  const wanted = [...new Set(formData.getAll('svc').map(String))];
  const services = wanted.length ? await prisma.service.findMany({ where: { id: { in: wanted }, restaurantId: restaurant.id }, select: { id: true } }) : [];
  const offers: { serviceId: string; durationMin: number | null }[] = [];
  for (const sv of services) {
    const rawMin = String(formData.get(`dur_${sv.id}`) ?? '').trim();
    let durationMin: number | null = null;
    if (rawMin) {
      durationMin = Number(rawMin);
      if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 600) return fail('O tempo de cada serviço vai de 5 a 600 minutos.', formData);
    }
    offers.push({ serviceId: sv.id, durationMin });
  }

  let photoImageId = existing?.photoImageId ?? null;
  try {
    const photo = String(formData.get('photoData') ?? '');
    if (photo) photoImageId = await saveImageFromDataUrl(restaurant.id, photo, photoImageId);
    else if (formData.get('removePhoto') === 'on' && photoImageId) {
      await prisma.image.deleteMany({ where: { id: photoImageId, restaurantId: restaurant.id } });
      photoImageId = null;
    }
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }

  const data = { name: d.name, capacity: d.capacity, unitId, email: d.email || null, phone, schedule, photoImageId };
  await prisma.$transaction(async (tx) => {
    const resource = existing
      ? await tx.resource.update({ where: { id: existing.id }, data })
      : await tx.resource.create({ data: { ...data, restaurantId: restaurant.id } });
    await tx.resourceService.deleteMany({ where: { resourceId: resource.id } });
    if (offers.length) await tx.resourceService.createMany({ data: offers.map((o) => ({ ...o, resourceId: resource.id })) });
  });
  refresh();
  return { ok: existing ? 'Salvo.' : 'Profissional adicionado.' };
}

/** Com agendamentos no histórico só desativa (o histórico guarda o nome); sem nenhum, apaga. */
export async function removeResource(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  const where = { id, restaurantId: restaurant.id };
  if (await prisma.booking.count({ where: { resourceId: id } })) await prisma.resource.updateMany({ where, data: { active: false } });
  else await prisma.resource.deleteMany({ where });
  refresh();
}

// ---------------------------------------------------------------- Serviços

const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do serviço (ex.: Corte masculino).').max(60),
  description: z.string().trim().max(200).default(''),
  durationMin: z.coerce.number().int('Use um número inteiro.').min(5, 'A duração mínima é 5 minutos.').max(600, 'A duração máxima é 10 horas.'),
  price: z.string().default(''),
  pointsDiscountMaxPct: z.coerce.number().int().refine((n) => [0, 10, 20, 30, 50, 100].includes(n), 'Escolha uma porcentagem da lista.').default(0),
});

export async function addService(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = serviceSchema.safeParse({
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    durationMin: formData.get('durationMin') ?? '',
    price: formData.get('price') ?? '',
    pointsDiscountMaxPct: formData.get('pointsDiscountMaxPct') ?? '0',
  });
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const priceCents = parsed.data.price.trim() ? parseMoneyToCents(parsed.data.price) : 0;
  if (priceCents === null || priceCents > 100_000_00) return fail('Preço inválido. Exemplo: 45,00 (deixe vazio se não cobrar).', formData);

  // Quem ainda não cadastrou equipe começa com uma vaga única, para o serviço já poder ser marcado.
  if (!(await prisma.resource.count({ where: { restaurantId: restaurant.id, active: true } }))) {
    await prisma.resource.create({ data: { restaurantId: restaurant.id, name: 'Atendimento', capacity: 1 } });
  }
  await prisma.service.create({
    data: {
      restaurantId: restaurant.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      durationMin: parsed.data.durationMin,
      priceCents,
      askPartySize: formData.get('askPartySize') === 'on',
      pointsDiscountMaxPct: priceCents > 0 ? parsed.data.pointsDiscountMaxPct : 0,
    },
  });
  refresh();
  return { ok: 'Serviço adicionado.' };
}

export async function removeService(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  const where = { id, restaurantId: restaurant.id };
  if (await prisma.booking.count({ where: { serviceId: id } })) await prisma.service.updateMany({ where, data: { active: false } });
  else await prisma.service.deleteMany({ where });
  refresh();
}

// ---------------------------------------------------------------- Agenda do dia (ações do dono)

const safeBack = (v: FormDataEntryValue | null) => (typeof v === 'string' && v.startsWith('/dashboard/agenda') ? v : '/dashboard/agenda');

/** Confirmar, concluir (credita os pontos), marcar falta ou cancelar um agendamento. */
export async function bookingAction(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('id') ?? '');
  const op = String(formData.get('op') ?? '');
  const back = safeBack(formData.get('back'));
  const sep = back.includes('?') ? '&' : '?';
  let notice = '';
  try {
    if (op === 'confirm') await confirmBooking(id, restaurant.id);
    else if (op === 'complete') {
      const r = await completeBooking(id, restaurant.id);
      notice = r.points > 0 ? `ok=${encodeURIComponent(`Concluído. ${r.points.toLocaleString('pt-BR')} pontos creditados ao cliente.`)}` : 'ok=Concluído.';
    } else if (op === 'noshow') await markNoShow(id, restaurant.id);
    else if (op === 'cancel') await cancelByOwner(id, restaurant.id);
    else notice = 'erro=Ação inválida.';
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
    notice = `erro=${encodeURIComponent(e.message)}`;
  }
  revalidatePath('/dashboard', 'layout');
  redirect(notice ? `${back}${sep}${notice}` : back);
}
