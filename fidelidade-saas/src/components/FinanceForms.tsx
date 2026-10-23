'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { saveCommissionPct, saveFinanceEntry } from '@/app/actions/finance';
import { DESC_MAX, IN_CATEGORIES, OUT_CATEGORIES, type EntryKind } from '@/lib/finance';
import { FormMessage, SubmitButton } from './ui';

/** Lançar uma despesa ou uma entrada (avulsa ou fixa, que se repete todo mês). */
export function FinanceEntryForm({ today }: { today: string }) {
  const [state, action] = useActionState(saveFinanceEntry, {});
  const [kind, setKind] = useState<EntryKind>((state.values?.kind as EntryKind) || 'OUT');
  const [monthly, setMonthly] = useState(state.values?.recurrence === 'MONTHLY');
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { form.current?.reset(); setMonthly(false); } }, [state]);
  const cats = kind === 'IN' ? IN_CATEGORIES : OUT_CATEGORIES;
  return (
    <form ref={form} action={action} className="space-y-3" data-testid="entry-form">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de lançamento">
        {([['OUT', 'Despesa'], ['IN', 'Entrada']] as const).map(([k, label]) => (
          <label key={k} className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold ${kind === k ? (k === 'OUT' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700') : 'border-slate-200 bg-white text-slate-600'}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" data-testid={`kind-${k}`} />
            {label}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor="fe-desc">Descrição</label>
          <input id="fe-desc" name="description" className="glass-input" maxLength={DESC_MAX} placeholder={kind === 'OUT' ? 'Ex.: Aluguel da loja' : 'Ex.: Venda de pomada'} defaultValue={state.values?.description} required data-testid="entry-desc" />
        </div>
        <div>
          <label className="glass-label" htmlFor="fe-cat">Categoria</label>
          <select id="fe-cat" name="category" className="glass-input" key={kind} defaultValue={state.values?.category && (cats as readonly string[]).includes(state.values.category) ? state.values.category : cats[0]} data-testid="entry-cat">
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor="fe-amount">Valor (R$)</label>
          <input id="fe-amount" name="amount" inputMode="decimal" className="glass-input" placeholder="0,00" defaultValue={state.values?.amount} required data-testid="entry-amount" />
        </div>
        <div>
          <label className="glass-label" htmlFor="fe-date">{monthly ? 'Começa em' : 'Data'}</label>
          <input id="fe-date" name="date" type="date" className="glass-input" defaultValue={state.values?.date || today} required data-testid="entry-date" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" name="recurrence" value="MONTHLY" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} className="h-4 w-4 rounded accent-electric-500" data-testid="entry-monthly" />
            Repete todo mês (despesa fixa)
          </label>
        </div>
        {monthly && (
          <div className="sm:col-span-2">
            <label className="glass-label" htmlFor="fe-end">Termina em <span className="font-normal text-slate-400">(opcional)</span></label>
            <input id="fe-end" name="endsOn" type="date" className="glass-input sm:max-w-xs" defaultValue={state.values?.endsOn} />
          </div>
        )}
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…" className="btn-sm !w-auto px-6" data-testid="entry-save">Lançar</SubmitButton>
    </form>
  );
}

/** Percentual de comissão de um profissional, salvo na hora de tocar em Salvar. */
export function CommissionPctForm({ resourceId, pct }: { resourceId: string; pct: string }) {
  const [state, action] = useActionState(saveCommissionPct, {});
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input name="pct" inputMode="decimal" defaultValue={state.values?.pct ?? pct} className="glass-input !w-16 !px-2 !py-1 text-right !text-sm" aria-label="Comissão em porcentagem" data-testid="commission-pct" /> <span className="text-sm text-slate-500">%</span>
      <SubmitButton pendingText="…" variant="ghost" className="btn-sm !w-auto px-3" data-testid="commission-save">Salvar</SubmitButton>
      {state.error && <span role="alert" className="text-xs font-semibold text-rose-600">{state.error}</span>}
      {state.ok && <span role="status" className="text-xs font-semibold text-emerald-600">✓</span>}
    </form>
  );
}
