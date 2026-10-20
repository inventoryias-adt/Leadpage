'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { canCustomerCancel } from '@/lib/booking';
import { SlotGoneError, alternativeSlots, answerReminder, bookSlot, cancelBooking, holdSlot, rescheduleBooking } from '@/lib/booking-db';
import { BusinessError } from '@/lib/claims';
import { fail, type BookingState, type FormState, type HoldState } from '@/lib/form';
import { TOO_MANY, allow } from '@/lib/rate-limit';
import { getCustomer } from '@/lib/session';

const schema = z.object({
  restaurantId: z.string().regex(/^[0-9a-f-]{36}$/),
  serviceId: z.string().regex(/^[0-9a-f-]{36}$/),
  unitId: z.string().regex(/^[0-9a-f-]{36}$/),
  resourceId: z.string().default(''),
  date: z.string(),
  time: z.string(),
  partySize: z.string().default(''),
  usePoints: z.string().default('0'),
  note: z.string().max(300, 'O recado pode ter até 300 caracteres.').default(''),
});

/** O cliente confirma o horário escolhido. Tudo é conferido de novo aqui (nada vem pronto do navegador). */
export async function createBooking(_: BookingState, formData: FormData): Promise<BookingState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Sua sessão expirou. Entre novamente para agendar.' };
  const parsed = schema.safeParse({
    restaurantId: formData.get('restaurantId') ?? '',
    serviceId: formData.get('serviceId') ?? '',
    unitId: formData.get('unitId') ?? '',
    resourceId: formData.get('resourceId') ?? '',
    date: formData.get('date') ?? '',
    time: formData.get('time') ?? '',
    partySize: formData.get('partySize') ?? '',
    usePoints: formData.get('usePoints') ?? '0',
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message.includes('300') ? parsed.error.issues[0].message : 'Não foi possível ler o horário. Escolha de novo.', formData);
  if (!(await allow(`book:${customer.id}`, 20, 3600))) return fail(TOO_MANY, formData);

  const d = parsed.data;
  let id: string;
  try {
    const booking = await bookSlot(customer.id, { ...d, partySize: d.partySize ? Number(d.partySize) : null, usePoints: Number(d.usePoints) || 0, resourceId: /^[0-9a-f-]{36}$/.test(d.resourceId) ? d.resourceId : null });
    id = booking.id;
  } catch (e) {
    // Alguém fechou o horário antes: em vez de só avisar, já oferece os mais próximos.
    if (e instanceof SlotGoneError) return { ...fail(e.message, formData), alternatives: await suggestAlternatives(customer.id, d.restaurantId, d.serviceId, d.unitId, d.date, d.time, d.resourceId) };
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  revalidatePath('/perfil/agendamentos');
  redirect(`/perfil/agendamentos?novo=${id}`);
}

const rescheduleSchema = z.object({
  id: z.string().regex(/^[0-9a-f-]{36}$/),
  resourceId: z.string().default(''),
  date: z.string(),
  time: z.string(),
});

/** O cliente remarca o próprio agendamento (novo dia, horário e/ou profissional), dentro da antecedência que o lugar exige. */
export async function rescheduleMyBooking(_: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Sua sessão expirou. Entre novamente para remarcar.' };
  const parsed = rescheduleSchema.safeParse({ id: formData.get('id') ?? '', resourceId: formData.get('resourceId') ?? '', date: formData.get('date') ?? '', time: formData.get('time') ?? '' });
  if (!parsed.success) return fail('Não foi possível ler o horário. Escolha de novo.', formData);
  if (!(await allow(`resched:${customer.id}`, 15, 3600))) return fail(TOO_MANY, formData);
  const d = parsed.data;
  try {
    await rescheduleBooking(customer.id, d.id, { date: d.date, time: d.time, resourceId: /^[0-9a-f-]{36}$/.test(d.resourceId) ? d.resourceId : null });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  revalidatePath('/perfil/agendamentos');
  revalidatePath('/carteira');
  redirect(`/perfil/agendamentos?remarcado=${d.id}`);
}

/** O cliente cancela o próprio agendamento, dentro da antecedência que o lugar exige. */
export async function cancelMyBooking(formData: FormData) {
  const customer = await getCustomer();
  if (!customer) redirect('/entrar?next=/perfil/agendamentos');
  const id = String(formData.get('id') ?? '');
  const booking = await prisma.booking.findFirst({ where: { id, customerId: customer.id }, include: { restaurant: { select: { bookingCancelHours: true } } } });
  if (!booking) redirect('/perfil/agendamentos');
  if (!canCustomerCancel(booking, booking.restaurant.bookingCancelHours)) redirect('/perfil/agendamentos?erro=prazo');
  try {
    await cancelBooking(id, 'CUSTOMER', { customerId: customer.id });
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
  }
  revalidatePath('/perfil/agendamentos');
  redirect('/perfil/agendamentos?cancelado=1');
}

/** Resposta ao "está tudo certo?": "sim" confirma presença, "não" libera o horário. */
export async function answerBookingReminder(formData: FormData) {
  const customer = await getCustomer();
  if (!customer) redirect('/entrar?next=/perfil/agendamentos');
  const id = String(formData.get('id') ?? '');
  const answer = formData.get('answer') === 'no' ? 'no' : 'yes';
  // Quem respondeu pela Início ou pelos Avisos volta para lá; o padrão é a lista de agendamentos.
  const backRaw = String(formData.get('back') ?? '');
  const base = backRaw === '/carteira' || backRaw === '/avisos' ? backRaw : '/perfil/agendamentos';
  let result: { canceled: boolean };
  try {
    result = await answerReminder(id, customer.id, answer);
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
    redirect(`${base}?erro=${encodeURIComponent(e.message)}`);
  }
  revalidatePath('/perfil/agendamentos');
  revalidatePath(base);
  redirect(result.canceled ? `${base}?liberado=1` : `${base}?presenca=1`);
}


/** Os horários livres mais próximos do que o cliente queria, para oferecer quando alguém pegou o horário antes. */
async function suggestAlternatives(customerId: string, restaurantId: string, serviceId: string, unitId: string, date: string, time: string, resourceId: string) {
  try {
    const [restaurant, service, unit] = await Promise.all([
      prisma.restaurant.findUnique({ where: { id: restaurantId } }),
      prisma.service.findFirst({ where: { id: serviceId, restaurantId, active: true } }),
      prisma.unit.findFirst({ where: { id: unitId, restaurantId, active: true } }),
    ]);
    if (!restaurant || !service || !unit) return [];
    return await alternativeSlots(prisma, { restaurantId, policy: restaurant, service, unit, date, time, resourceId: /^[0-9a-f-]{36}$/.test(resourceId) ? resourceId : null, customerId, limit: 3 });
  } catch {
    return [];
  }
}

const holdSchema = z.object({
  restaurantId: z.string().regex(/^[0-9a-f-]{36}$/),
  serviceId: z.string().regex(/^[0-9a-f-]{36}$/),
  unitId: z.string().regex(/^[0-9a-f-]{36}$/),
  resourceId: z.string().default(''),
  date: z.string(),
  time: z.string(),
});

/** Segura o horário escolhido para o cliente por alguns minutos (a tela chama assim que ele abre o "Confirmar"). */
export async function holdBookingSlot(input: z.input<typeof holdSchema>): Promise<HoldState> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, error: 'Sua sessão expirou. Entre novamente para agendar.' };
  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Não foi possível ler o horário. Escolha de novo.' };
  if (!(await allow(`hold:${customer.id}`, 60, 3600))) return { ok: false, error: TOO_MANY };
  const d = parsed.data;
  try {
    const hold = await holdSlot(customer.id, { ...d, resourceId: /^[0-9a-f-]{36}$/.test(d.resourceId) ? d.resourceId : null });
    return { ok: true, expiresAt: hold.expiresAt.toISOString() };
  } catch (e) {
    if (e instanceof SlotGoneError) return { ok: false, gone: true, error: e.message, alternatives: await suggestAlternatives(customer.id, d.restaurantId, d.serviceId, d.unitId, d.date, d.time, d.resourceId) };
    if (e instanceof BusinessError) return { ok: false, error: e.message };
    throw e;
  }
}
