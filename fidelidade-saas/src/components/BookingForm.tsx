'use client';

import { useActionState } from 'react';
import { createBooking } from '@/app/actions/booking';
import { PointsDiscountField } from './PointsDiscountField';
import { FormMessage, SubmitButton } from './ui';

/** Último passo: confirma o horário escolhido. Quantas pessoas só aparece em reserva de mesa. */
export function BookingForm({
  hidden,
  askPartySize,
  discount,
}: {
  hidden: { restaurantId: string; serviceId: string; unitId: string; date: string; time: string };
  askPartySize: boolean;
  discount?: { priceCents: number; balance: number; rate: number; maxPoints: number; maxPct: number } | null;
}) {
  const [state, action] = useActionState(createBooking, {});
  return (
    <form action={action} className="space-y-4">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {askPartySize && (
        <div>
          <label className="glass-label" htmlFor="bk-party">Quantas pessoas?</label>
          <input id="bk-party" name="partySize" type="number" min={1} max={30} inputMode="numeric" className="glass-input" defaultValue={state.values?.partySize ?? '2'} required />
        </div>
      )}
      {discount && discount.maxPoints > 0 && <PointsDiscountField {...discount} />}
      <div>
        <label className="glass-label" htmlFor="bk-note">Recado para o lugar <span className="font-normal text-slate-400">(opcional)</span></label>
        <textarea id="bk-note" name="note" rows={2} maxLength={300} className="glass-input" placeholder="Alguma preferência ou observação?" defaultValue={state.values?.note} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Agendando…">Confirmar agendamento</SubmitButton>
    </form>
  );
}
