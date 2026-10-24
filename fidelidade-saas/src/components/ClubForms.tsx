'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { addClubSubscriber, saveClubPlan } from '@/app/actions/club';
import { PLAN_DESC_MAX, PLAN_NAME_MAX } from '@/lib/club';
import { FormMessage, SubmitButton } from './ui';

type Svc = { id: string; name: string; priceLabel: string };
type PlanDefaults = { id: string; name: string; description: string; price: string; items: Record<string, number> };

/** Monta ou edita um plano: nome, valor mensal e, para cada serviço incluído, quantas vezes por mês. */
export function ClubPlanForm({ services, plan, uid }: { services: Svc[]; plan?: PlanDefaults; uid: string }) {
  const [state, action] = useActionState(saveClubPlan, {});
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(services.map((s) => [s.id, !!plan && s.id in plan.items])));
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok && !plan) { form.current?.reset(); setChecked({}); } }, [state, plan]);
  return (
    <form ref={form} action={action} className="space-y-3" data-testid={plan ? 'plan-edit-form' : 'plan-form'}>
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <div>
          <label className="glass-label" htmlFor={`${uid}-name`}>Nome do plano</label>
          <input id={`${uid}-name`} name="name" className="glass-input" maxLength={PLAN_NAME_MAX} placeholder="Ex.: Clube do Corte" defaultValue={state.values?.name ?? plan?.name} required data-testid="plan-name" />
        </div>
        <div>
          <label className="glass-label" htmlFor={`${uid}-price`}>Valor por mês (R$)</label>
          <input id={`${uid}-price`} name="price" inputMode="decimal" className="glass-input" placeholder="0,00" defaultValue={state.values?.price ?? plan?.price} required data-testid="plan-price" />
        </div>
      </div>
      <div>
        <label className="glass-label" htmlFor={`${uid}-desc`}>Descrição <span className="font-normal text-slate-400">(opcional)</span></label>
        <input id={`${uid}-desc`} name="description" className="glass-input" maxLength={PLAN_DESC_MAX} placeholder="Ex.: Para quem não quer ficar sem aparar." defaultValue={state.values?.description ?? plan?.description} />
      </div>
      <fieldset className="space-y-2">
        <legend className="glass-label">O que o plano inclui por mês</legend>
        {services.length === 0 ? (
          <p className="text-sm text-slate-500">Cadastre os serviços na Agenda para montar um plano.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {services.map((sv) => (
              <li key={sv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" name="svc" value={sv.id} checked={!!checked[sv.id]} onChange={(e) => setChecked((c) => ({ ...c, [sv.id]: e.target.checked }))} className="h-4 w-4 shrink-0 rounded accent-electric-500" data-testid={`svc-${sv.id}`} />
                  <span className="truncate">{sv.name} <span className="text-xs text-slate-400">{sv.priceLabel}</span></span>
                </label>
                {checked[sv.id] && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input name={`qty_${sv.id}`} type="number" min={1} max={99} inputMode="numeric" className="glass-input !w-16 !px-2 !py-1 !text-sm" defaultValue={plan?.items[sv.id] ?? 1} aria-label={`Vezes por mês de ${sv.name}`} data-testid={`qty-${sv.id}`} /> por mês
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…" className="btn-sm !w-auto px-6" data-testid="plan-save">{plan ? 'Salvar plano' : 'Criar plano'}</SubmitButton>
    </form>
  );
}

/** Cadastra um assinante pelo CPF (o cliente precisa ter conta no Fidelize). */
export function AddSubscriberForm({ plans }: { plans: { id: string; name: string }[] }) {
  const [state, action] = useActionState(addClubSubscriber, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  if (plans.length === 0) return <p className="text-sm text-slate-500">Crie um plano ativo para poder cadastrar assinantes.</p>;
  return (
    <form ref={form} action={action} className="space-y-3" data-testid="subscriber-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="sub-cpf">CPF do cliente</label>
          <input id="sub-cpf" name="cpf" inputMode="numeric" className="glass-input" placeholder="000.000.000-00" defaultValue={state.values?.cpf} required data-testid="sub-cpf" />
        </div>
        <div>
          <label className="glass-label" htmlFor="sub-plan">Plano</label>
          <select id="sub-plan" name="planId" className="glass-input" defaultValue={state.values?.planId} data-testid="sub-plan">
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="paid" defaultChecked className="h-4 w-4 rounded accent-electric-500" data-testid="sub-paid" />
        Já recebi o primeiro pagamento (o plano começa hoje)
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="Cadastrando…" className="btn-sm !w-auto px-6" data-testid="sub-save">Cadastrar assinante</SubmitButton>
    </form>
  );
}
