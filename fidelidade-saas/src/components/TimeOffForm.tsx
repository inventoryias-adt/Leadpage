'use client';

import { useActionState } from 'react';
import { addTimeOff } from '@/app/actions/agenda';
import { FormMessage, SubmitButton } from './ui';

/** Bloquear um período: folga, férias, almoço, manutenção. Sem horas = o dia inteiro. */
export function TimeOffForm({ staff, today }: { staff: { id: string; name: string }[]; today: string }) {
  const [state, action] = useActionState(addTimeOff, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" data-testid="timeoff-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="to-who">Quem fica indisponível</label>
          <select id="to-who" name="resourceId" className="glass-input" defaultValue={v.resourceId ?? ''}>
            <option value="">Todos (o lugar fecha)</option>
            {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor="to-reason">Motivo <span className="font-normal text-slate-400">(opcional)</span></label>
          <input id="to-reason" name="reason" className="glass-input" maxLength={80} placeholder="Férias, almoço, feriado…" defaultValue={v.reason} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="to-start">De (dia)</label>
          <input id="to-start" name="startDate" type="date" className="glass-input" min={today} defaultValue={v.startDate ?? today} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="to-end">Até (dia) <span className="font-normal text-slate-400">(vazio = só esse dia)</span></label>
          <input id="to-end" name="endDate" type="date" className="glass-input" min={today} defaultValue={v.endDate} />
        </div>
        <div>
          <label className="glass-label" htmlFor="to-from">Das <span className="font-normal text-slate-400">(vazio = dia inteiro)</span></label>
          <input id="to-from" name="startTime" type="time" className="glass-input" defaultValue={v.startTime} />
        </div>
        <div>
          <label className="glass-label" htmlFor="to-until">Até</label>
          <input id="to-until" name="endTime" type="time" className="glass-input" defaultValue={v.endTime} />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Bloquear período</SubmitButton>
    </form>
  );
}
