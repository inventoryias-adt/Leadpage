'use client';

import { useActionState, useState } from 'react';
import { addResource, addService, saveBookingPolicy } from '@/app/actions/agenda';
import { cashbackPct } from '@/lib/points-discount';
import { FormMessage, SubmitButton } from './ui';

const NOTICE: [number, string][] = [[0, 'Sem antecedência'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [720, '12 horas'], [1440, '1 dia']];
const AHEAD: [number, string][] = [[7, '7 dias'], [14, '14 dias'], [30, '30 dias'], [60, '60 dias'], [90, '90 dias']];
const CANCEL: [number, string][] = [[0, 'Até a hora marcada'], [1, '1 hora antes'], [2, '2 horas antes'], [4, '4 horas antes'], [12, '12 horas antes'], [24, '1 dia antes'], [48, '2 dias antes']];

/** Escolhe a opção da lista mais próxima do valor salvo (o valor pode ter vindo de uma versão anterior). */
const pick = (list: [number, string][], v: number) => list.reduce((best, o) => (Math.abs(o[0] - v) < Math.abs(best[0] - v) ? o : best))[0];

export function BookingPolicyForm({ defaults }: { defaults: { auto: boolean; minNotice: number; maxAhead: number; cancelHours: number; pointsPerRealOff: number; earnPerReal: number } }) {
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
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar regras</SubmitButton>
    </form>
  );
}

export function AddResourceForm({ units }: { units: { id: string; name: string }[] }) {
  const [state, action] = useActionState(addResource, {});
  return (
    <form action={action} className="space-y-3" key={state.ok ?? 'idle'}>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_1fr]">
        <div>
          <label className="glass-label" htmlFor="rs-name">Nome</label>
          <input id="rs-name" name="name" className="glass-input" placeholder="Ex.: João, Sala 1, Mesas" defaultValue={state.values?.name} maxLength={40} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="rs-cap">Ao mesmo tempo</label>
          <input id="rs-cap" name="capacity" type="number" min={1} max={60} inputMode="numeric" className="glass-input" defaultValue={state.values?.capacity ?? '1'} required />
        </div>
        {units.length > 1 && (
          <div>
            <label className="glass-label" htmlFor="rs-unit">Unidade</label>
            <select id="rs-unit" name="unitId" className="glass-input" defaultValue={state.values?.unitId ?? ''}>
              <option value="">Todas</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">“Ao mesmo tempo” é quantos atendimentos esse profissional ou espaço faz em paralelo: 1 para uma pessoa; um número maior para uma sala de mesas.</p>
      <FormMessage state={state} />
      <SubmitButton pendingText="Adicionando…" variant="ghost">Adicionar profissional ou vaga</SubmitButton>
    </form>
  );
}

export function AddServiceForm({ resources }: { resources: { id: string; name: string }[] }) {
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
        {resources.length > 1 && (
          <div className="sm:col-span-2">
            <label className="glass-label" htmlFor="sv-res">Quem faz</label>
            <select id="sv-res" name="resourceId" className="glass-input" defaultValue={state.values?.resourceId ?? ''}>
              <option value="">Qualquer profissional ou vaga</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
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
