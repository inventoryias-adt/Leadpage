'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { canCustomerCancel } from '@/lib/booking';
import { bookSlot, cancelBooking } from '@/lib/booking-db';
import { BusinessError } from '@/lib/claims';
import { fail, type FormState } from '@/lib/form';
import { TOO_MANY, allow } from '@/lib/rate-limit';
import { getCustomer } from '@/lib/session';

const schema = z.object({
  restaurantId: z.string().regex(/^[0-9a-f-]{36}$/),
  serviceId: z.string().regex(/^[0-9a-f-]{36}$/),
  unitId: z.string().regex(/^[0-9a-f-]{36}$/),
  date: z.string(),
  time: z.string(),
  partySize: z.string().default(''),
  usePoints: z.string().default('0'),
  note: z.string().max(300, 'O recado pode ter até 300 caracteres.').default(''),
});

/** O cliente confirma o horário escolhido. Tudo é conferido de novo aqui (nada vem pronto do navegador). */
export async function createBooking(_: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Sua sessão expirou. Entre novamente para agendar.' };
  const parsed = schema.safeParse({
    restaurantId: formData.get('restaurantId') ?? '',
    serviceId: formData.get('serviceId') ?? '',
    unitId: formData.get('unitId') ?? '',
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
    const booking = await bookSlot(customer.id, { ...d, partySize: d.partySize ? Number(d.partySize) : null, usePoints: Number(d.usePoints) || 0 });
    id = booking.id;
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  revalidatePath('/perfil/agendamentos');
  redirect(`/perfil/agendamentos?novo=${id}`);
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
