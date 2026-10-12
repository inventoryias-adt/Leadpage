'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, type FormState } from '@/lib/form';
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
});

export async function saveBookingPolicy(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = policySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message.startsWith('Use ao menos') ? parsed.error.issues[0].message : 'Confira os números das regras de agendamento.', formData);
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { ...parsed.data, bookingAutoConfirm: formData.get('bookingAutoConfirm') === 'on' },
  });
  refresh();
  return { ok: 'Regras de agendamento salvas.' };
}

// ---------------------------------------------------------------- Equipe e vagas

const resourceSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome (ex.: João, Sala 1, Mesas).').max(40),
  capacity: z.coerce.number().int('Use um número inteiro.').min(1, 'No mínimo 1 atendimento por vez.').max(60, 'No máximo 60 ao mesmo tempo.'),
  unitId: z.string().default(''),
});

export async function addResource(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = resourceSchema.safeParse({ name: formData.get('name') ?? '', capacity: formData.get('capacity') ?? '1', unitId: formData.get('unitId') ?? '' });
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  let unitId: string | null = null;
  if (parsed.data.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: parsed.data.unitId, restaurantId: restaurant.id, active: true }, select: { id: true } });
    if (!unit) return fail('Unidade não encontrada.', formData);
    unitId = unit.id;
  }
  await prisma.resource.create({ data: { restaurantId: restaurant.id, name: parsed.data.name, capacity: parsed.data.capacity, unitId } });
  refresh();
  return { ok: 'Adicionado.' };
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
  resourceId: z.string().default(''),
  pointsDiscountMaxPct: z.coerce.number().int().refine((n) => [0, 10, 20, 30, 50, 100].includes(n), 'Escolha uma porcentagem da lista.').default(0),
});

export async function addService(_: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await requirePaidRestaurant();
  const parsed = serviceSchema.safeParse({
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    durationMin: formData.get('durationMin') ?? '',
    price: formData.get('price') ?? '',
    resourceId: formData.get('resourceId') ?? '',
    pointsDiscountMaxPct: formData.get('pointsDiscountMaxPct') ?? '0',
  });
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const priceCents = parsed.data.price.trim() ? parseMoneyToCents(parsed.data.price) : 0;
  if (priceCents === null || priceCents > 100_000_00) return fail('Preço inválido. Exemplo: 45,00 (deixe vazio se não cobrar).', formData);

  let resourceId: string | null = null;
  if (parsed.data.resourceId) {
    const r = await prisma.resource.findFirst({ where: { id: parsed.data.resourceId, restaurantId: restaurant.id, active: true }, select: { id: true } });
    if (!r) return fail('Profissional ou vaga não encontrado.', formData);
    resourceId = r.id;
  }
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
      resourceId,
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
