'use client';

import { useActionState } from 'react';
import { rescheduleMyBooking } from '@/app/actions/booking';
import { FormMessage, SubmitButton } from './ui';

/** Último passo do reagendamento: confirma o novo horário (o serviço, o preço e o desconto com pontos continuam os mesmos). */
export function RescheduleForm({ bookingId, date, time, resourceId }: { bookingId: string; date: string; time: string; resourceId: string }) {
  const [state, action] = useActionState(rescheduleMyBooking, {});
  return (
    <form action={action} className="space-y-3" autoComplete="off">
      <input type="hidden" name="id" value={bookingId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="resourceId" value={resourceId} />
      <FormMessage state={state} />
      <SubmitButton variant="navy" pendingText="Remarcando…">Confirmar novo horário</SubmitButton>
    </form>
  );
}
