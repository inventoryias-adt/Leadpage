'use client';

import { useActionState, useState } from 'react';
import { adminSaveAppCampaign } from '@/app/actions/app-campaigns';
import { FormMessage, SubmitButton } from './ui';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export type CampaignFormValues = {
  id?: string;
  title?: string;
  description?: string;
  kind?: 'MULTIPLIER' | 'BONUS';
  multiplier?: number | null;
  bonusPoints?: number | null;
  minAmount?: string;
  weekdays?: number[];
  startTime?: string | null;
  endTime?: string | null;
  startDate?: string;
  endDate?: string;
};

/** Formulário do administrador para criar ou editar uma campanha do app. */
export function AppCampaignForm({ initial = {}, uid }: { initial?: CampaignFormValues; uid: string }) {
  const [state, action] = useActionState(adminSaveAppCampaign, {});
  const v = state.values;
  const [kind, setKind] = useState<'MULTIPLIER' | 'BONUS'>((v?.kind as 'MULTIPLIER' | 'BONUS') ?? initial.kind ?? 'MULTIPLIER');
  const days = initial.weekdays ?? [];
  return (
    <form action={action} className="space-y-4" key={state.ok ?? 'idle'}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor={`${uid}-title`}>Nome da campanha</label>
          <input id={`${uid}-title`} name="title" className="glass-input" placeholder="Ex.: Terça e quinta em dobro" defaultValue={v?.title ?? initial.title} maxLength={80} required />
        </div>
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor={`${uid}-desc`}>Descrição para o cliente <span className="font-normal text-slate-500">— opcional</span></label>
          <textarea id={`${uid}-desc`} name="description" rows={2} className="glass-input" placeholder="Ex.: Compre nos lugares participantes e ganhe o dobro de pontos." defaultValue={v?.description ?? initial.description} maxLength={300} />
        </div>
        <div>
          <label className="glass-label" htmlFor={`${uid}-kind`}>Tipo</label>
          <select id={`${uid}-kind`} name="kind" className="glass-input" value={kind} onChange={(e) => setKind(e.target.value as 'MULTIPLIER' | 'BONUS')}>
            <option value="MULTIPLIER">Multiplicar os pontos da compra</option>
            <option value="BONUS">Dar pontos extras na compra</option>
          </select>
        </div>
        {kind === 'MULTIPLIER' ? (
          <div>
            <label className="glass-label" htmlFor={`${uid}-mult`}>Multiplicador</label>
            <input id={`${uid}-mult`} name="multiplier" inputMode="decimal" className="glass-input" placeholder="2 = pontos em dobro" defaultValue={v?.multiplier ?? initial.multiplier ?? '2'} required />
          </div>
        ) : (
          <div>
            <label className="glass-label" htmlFor={`${uid}-bonus`}>Pontos extras por compra</label>
            <input id={`${uid}-bonus`} name="bonusPoints" type="number" min={1} inputMode="numeric" className="glass-input" placeholder="Ex.: 50" defaultValue={v?.bonusPoints ?? initial.bonusPoints ?? ''} required />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor={`${uid}-min`}>Valor mínimo da compra (R$) <span className="font-normal text-slate-500">— opcional</span></label>
          <input id={`${uid}-min`} name="minAmount" inputMode="decimal" className="glass-input" placeholder="Ex.: 40,00" defaultValue={v?.minAmount ?? initial.minAmount} />
        </div>
      </div>
      <fieldset>
        <legend className="glass-label">Dias da semana <span className="font-normal text-slate-500">— nenhum marcado = todos os dias</span></legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((d, i) => (
            <label key={d} className="inline-flex items-center gap-2 rounded-full border border-[#D5DAE3] bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 has-[:checked]:border-electric-500 has-[:checked]:bg-electric-500 has-[:checked]:text-white">
              <input type="checkbox" name="weekdays" value={i} defaultChecked={days.includes(i)} className="sr-only" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="glass-label" htmlFor={`${uid}-st`}>Horário inicial</label><input id={`${uid}-st`} name="startTime" type="time" className="glass-input" defaultValue={v?.startTime ?? initial.startTime ?? ''} /></div>
        <div><label className="glass-label" htmlFor={`${uid}-et`}>Horário final</label><input id={`${uid}-et`} name="endTime" type="time" className="glass-input" defaultValue={v?.endTime ?? initial.endTime ?? ''} /></div>
        <div><label className="glass-label" htmlFor={`${uid}-sd`}>Começa em</label><input id={`${uid}-sd`} name="startDate" type="date" className="glass-input" defaultValue={v?.startDate ?? initial.startDate} /></div>
        <div><label className="glass-label" htmlFor={`${uid}-ed`}>Termina em</label><input id={`${uid}-ed`} name="endDate" type="date" className="glass-input" defaultValue={v?.endDate ?? initial.endDate} /></div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">{initial.id ? 'Salvar alterações' : 'Criar campanha'}</SubmitButton>
    </form>
  );
}
