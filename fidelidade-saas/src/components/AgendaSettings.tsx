'use client';

import { useActionState, useEffect, useState } from 'react';
import { addService, saveBookingPolicy, saveResource } from '@/app/actions/agenda';
import { defaultSchedule, type Schedule } from '@/lib/hours';
import { HoursGrid } from './HoursGrid';
import { ImageUpload } from './ImageUpload';
import { MaskedInput } from './MaskedInput';
import { cashbackPct } from '@/lib/points-discount';
import { FormMessage, SubmitButton } from './ui';

const NOTICE: [number, string][] = [[0, 'Sem antecedência'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [720, '12 horas'], [1440, '1 dia']];
const AHEAD: [number, string][] = [[7, '7 dias'], [14, '14 dias'], [30, '30 dias'], [60, '60 dias'], [90, '90 dias']];
const CANCEL: [number, string][] = [[0, 'Até a hora marcada'], [1, '1 hora antes'], [2, '2 horas antes'], [4, '4 horas antes'], [12, '12 horas antes'], [24, '1 dia antes'], [48, '2 dias antes']];

/** Escolhe a opção da lista mais próxima do valor salvo (o valor pode ter vindo de uma versão anterior). */
const pick = (list: [number, string][], v: number) => list.reduce((best, o) => (Math.abs(o[0] - v) < Math.abs(best[0] - v) ? o : best))[0];

export function BookingPolicyForm({ defaults }: { defaults: { auto: boolean; minNotice: number; maxAhead: number; cancelHours: number; pointsPerRealOff: number; earnPerReal: number; notifyEmail: string; accountEmail: string } }) {
  const [state, action] = useActionState(saveBookingPolicy, {});
  const [rate, setRate] = useState(String(defaults.pointsPerRealOff));
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="bookingAutoConfirm" defaultChecked={defaults.auto} className="mt-0.5 h-5 w-5 rounded accent-electric-500" />
        <span className="text-sm text-slate-700">
          <span className="font-semibold">Confirmar os agendamentos automaticamente</span>
          <span className="block text-xs text-slate-500">Desmarcado: cada pedido chega como “aguardando” e só vale depois que você confirmar na Agenda.</span>
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="glass-label" htmlFor="ag-notice">Antecedência mínima</label>
          <select id="ag-notice" name="bookingMinNoticeMin" className="glass-input" defaultValue={pick(NOTICE, defaults.minNotice)}>
            {NOTICE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor="ag-ahead">Marcar até</label>
          <select id="ag-ahead" name="bookingMaxDaysAhead" className="glass-input" defaultValue={pick(AHEAD, defaults.maxAhead)}>
            {AHEAD.map(([v, l]) => <option key={v} value={v}>{l} à frente</option>)}
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor="ag-cancel">Cliente cancela</label>
          <select id="ag-cancel" name="bookingCancelHours" className="glass-input" defaultValue={pick(CANCEL, defaults.cancelHours)}>
            {CANCEL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="glass-label" htmlFor="ag-rate">Pontos que valem R$ 1,00 de desconto</label>
        <input id="ag-rate" name="pointsPerRealOff" type="number" min={10} max={10000} inputMode="numeric" className="glass-input sm:!w-48" value={rate} onChange={(e) => setRate(e.target.value)} required />
        <p className="mt-1 text-xs text-slate-500">
          Vale para os serviços que aceitam pontos. Hoje o cliente ganha {defaults.earnPerReal} pontos a cada R$ 1,00 gasto
          {Number(rate) >= 10 ? <>: com {rate} pontos valendo R$ 1,00, voltam cerca de <strong>{cashbackPct(defaults.earnPerReal, Number(rate))}%</strong> do valor gasto em desconto.</> : '.'}
        </p>
      </div>
      <div>
        <label className="glass-label" htmlFor="ag-mail">E-mail que recebe cada novo agendamento</label>
        <input id="ag-mail" name="bookingNotifyEmail" type="email" className="glass-input sm:!w-80" placeholder={defaults.accountEmail} defaultValue={defaults.notifyEmail} />
        <p className="mt-1 text-xs text-slate-500">Vazio = o e-mail da sua conta. Cada profissional com e-mail também recebe os dele.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar regras</SubmitButton>
    </form>
  );
}

export type StaffData = {
  id: string;
  name: string;
  email: string;
  phone: string;
  capacity: number;
  unitId: string;
  schedule: Schedule | null;
  photoUrl: string | null;
  offers: Record<string, number | null>; // serviceId → minutos (null = padrão do serviço)
};

/** Cadastro (ou edição) de um profissional: foto, contato, dias e horários, serviços que faz e o tempo de cada um. */
export function StaffForm({
  staff,
  services,
  units,
  uid,
}: {
  staff?: StaffData;
  services: { id: string; name: string; durationMin: number }[];
  units: { id: string; name: string }[];
  uid: string;
}) {
  const [state, action] = useActionState(saveResource, {});
  const [follow, setFollow] = useState(staff ? staff.schedule === null : true);
  const [days, setDays] = useState<Schedule>(staff?.schedule ?? defaultSchedule());
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(services.map((sv) => [sv.id, staff ? sv.id in staff.offers : false])));
  // Depois de adicionar um profissional novo, o formulário volta ao começo (escala, serviços e campos).
  useEffect(() => {
    if (state.ok && !staff) {
      setFollow(true);
      setDays(defaultSchedule());
      setChecked({});
    }
  }, [state, staff]);
  const key = staff ? staff.id : state.ok ?? 'novo';

  return (
    <form action={action} className="space-y-4" key={key}>
      {staff && <input type="hidden" name="id" value={staff.id} />}
      <input type="hidden" name="schedule" value={JSON.stringify(days)} />
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <ImageUpload name="photoData" label="Foto" currentUrl={staff?.photoUrl} maxSide={360} hint="O cliente vê com quem vai ser atendido." />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="glass-label" htmlFor={`${uid}-name`}>Nome</label>
            <input id={`${uid}-name`} name="name" className="glass-input" placeholder="Ex.: Lucas (barbeiro), Sala 1, Mesas" defaultValue={state.values?.name ?? staff?.name} maxLength={40} required />
          </div>
          <div>
            <label className="glass-label" htmlFor={`${uid}-email`}>E-mail (recebe os agendamentos)</label>
            <input id={`${uid}-email`} name="email" type="email" className="glass-input" placeholder="opcional" defaultValue={state.values?.email ?? staff?.email} />
          </div>
          <div>
            <label className="glass-label" htmlFor={`${uid}-phone`}>WhatsApp</label>
            <MaskedInput mask="phone" id={`${uid}-phone`} name="phone" type="tel" placeholder="(11) 91234-5678" defaultValue={state.values?.phone ?? staff?.phone} />
          </div>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="glass-label">Dias e horários de trabalho</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="followUnit" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="h-4 w-4 rounded accent-electric-500" />
          Segue o horário de funcionamento da unidade
        </label>
        {!follow && <HoursGrid days={days} setDays={setDays} idPrefix={`${uid}-h`} />}
      </fieldset>

      {services.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="glass-label">Serviços que faz e quanto tempo leva</legend>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {services.map((sv) => (
              <li key={sv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" name="svc" value={sv.id} checked={!!checked[sv.id]} onChange={(e) => setChecked((c) => ({ ...c, [sv.id]: e.target.checked }))} className="h-4 w-4 shrink-0 rounded accent-electric-500" />
                  <span className="truncate">{sv.name}</span>
                </label>
                {checked[sv.id] && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input name={`dur_${sv.id}`} type="number" min={5} max={600} step={5} inputMode="numeric" className="glass-input !w-20 !px-2 !py-1 !text-sm" placeholder={String(sv.durationMin)} defaultValue={staff?.offers[sv.id] ?? ''} aria-label={`Minutos de ${sv.name}`} /> min
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">Marque o que ele faz; o tempo vazio usa o padrão do serviço. Serviço que ninguém marcou pode ser feito por qualquer profissional.</p>
        </fieldset>
      )}

      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Mais opções</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="glass-label" htmlFor={`${uid}-cap`}>Atendimentos ao mesmo tempo</label>
            <input id={`${uid}-cap`} name="capacity" type="number" min={1} max={60} inputMode="numeric" className="glass-input" defaultValue={state.values?.capacity ?? staff?.capacity ?? 1} />
            <p className="mt-1 text-xs text-slate-500">1 para uma pessoa; um número maior para uma sala ou mesas.</p>
          </div>
          {units.length > 1 && (
            <div>
              <label className="glass-label" htmlFor={`${uid}-unit`}>Unidade</label>
              <select id={`${uid}-unit`} name="unitId" className="glass-input" defaultValue={state.values?.unitId ?? staff?.unitId ?? ''}>
                <option value="">Todas</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          {staff?.photoUrl && (
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" name="removePhoto" className="h-4 w-4 rounded accent-electric-500" /> Remover a foto
            </label>
          )}
        </div>
      </details>

      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…" variant={staff ? 'ghost' : 'primary'}>{staff ? 'Salvar profissional' : 'Adicionar profissional'}</SubmitButton>
    </form>
  );
}

export function AddServiceForm() {
  const [state, action] = useActionState(addService, {});
  return (
    <form action={action} className="space-y-3" key={state.ok ?? 'idle'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor="sv-name">Nome do serviço</label>
          <input id="sv-name" name="name" className="glass-input" placeholder="Ex.: Corte masculino, Limpeza de pele, Reserva de mesa" defaultValue={state.values?.name} maxLength={60} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="sv-dur">Duração (minutos)</label>
          <input id="sv-dur" name="durationMin" type="number" min={5} max={600} step={5} inputMode="numeric" className="glass-input" placeholder="30" defaultValue={state.values?.durationMin} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="sv-price">Preço (R$)</label>
          <input id="sv-price" name="price" inputMode="decimal" className="glass-input" placeholder="45,00 (vazio = não cobra)" defaultValue={state.values?.price} />
        </div>
        <div>
          <label className="glass-label" htmlFor="sv-pts">Aceita pontos como desconto</label>
          <select id="sv-pts" name="pointsDiscountMaxPct" className="glass-input" defaultValue={state.values?.pointsDiscountMaxPct ?? '0'}>
            <option value="0">Não aceita</option>
            {[10, 20, 30, 50, 100].map((n) => <option key={n} value={n}>Até {n}% do preço</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor="sv-desc">Descrição (opcional)</label>
          <input id="sv-desc" name="description" className="glass-input" placeholder="O que está incluso" defaultValue={state.values?.description} maxLength={200} />
        </div>
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="askPartySize" defaultChecked={state.values?.askPartySize === 'on'} className="mt-0.5 h-5 w-5 rounded accent-electric-500" />
        <span className="text-sm text-slate-700">
          <span className="font-semibold">É reserva de mesa</span>
          <span className="block text-xs text-slate-500">Pergunta quantas pessoas vão. Use com uma vaga “Mesas” que atenda vários ao mesmo tempo.</span>
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="Adicionando…">Adicionar serviço</SubmitButton>
    </form>
  );
}
