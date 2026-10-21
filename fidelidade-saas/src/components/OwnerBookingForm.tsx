'use client';

import { useActionState } from 'react';
import { createOwnerBooking } from '@/app/actions/agenda';
import { MaskedInput } from './MaskedInput';
import { FormMessage, SubmitButton } from './ui';

/** Último passo do encaixe: quem é o cliente (CPF se tiver conta no app; senão nome e telefone). */
export function OwnerBookingForm({ hidden, askPartySize }: { hidden: { serviceId: string; unitId: string; resourceId: string; date: string; time: string }; askPartySize: boolean }) {
  const [state, action] = useActionState(createOwnerBooking, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" data-testid="owner-booking-form">
      {Object.entries(hidden).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <div>
        <label className="glass-label" htmlFor="ob-cpf">CPF do cliente <span className="font-normal text-slate-400">(se ele já tem conta no app)</span></label>
        <MaskedInput mask="cpf" id="ob-cpf" name="cpf" placeholder="000.000.000-00" defaultValue={v.cpf} />
        <p className="mt-1 text-xs text-slate-500">Com CPF, o cliente recebe o aviso no app e ganha os pontos quando você concluir o atendimento.</p>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ou, sem conta</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="ob-name">Nome</label>
          <input id="ob-name" name="guestName" className="glass-input" maxLength={80} autoComplete="off" defaultValue={v.guestName} />
        </div>
        <div>
          <label className="glass-label" htmlFor="ob-phone">Telefone (WhatsApp)</label>
          <MaskedInput mask="phone" id="ob-phone" name="guestPhone" placeholder="(00) 00000-0000" defaultValue={v.guestPhone} />
        </div>
      </div>
      {askPartySize && (
        <div>
          <label className="glass-label" htmlFor="ob-party">Quantas pessoas?</label>
          <input id="ob-party" name="partySize" type="number" min={1} max={30} inputMode="numeric" className="glass-input sm:!w-32" defaultValue={v.partySize ?? '2'} required />
        </div>
      )}
      <div>
        <label className="glass-label" htmlFor="ob-note">Observação <span className="font-normal text-slate-400">(opcional)</span></label>
        <textarea id="ob-note" name="note" rows={2} maxLength={300} className="glass-input" defaultValue={v.note} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Marcando…" variant="navy">Marcar horário</SubmitButton>
    </form>
  );
}
