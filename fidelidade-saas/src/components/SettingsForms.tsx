'use client';

import { useActionState } from 'react';
import { addInteraction, addReward, finishOnboarding, saveBasics, saveRules } from '@/app/actions/restaurant';
import { FormMessage, SubmitButton } from './ui';

type Basics = { name: string; address: string };

export function BasicsForm({ defaults }: { defaults: Basics }) {
  const [state, action] = useActionState(saveBasics, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="glass-label" htmlFor="b-name">Nome do estabelecimento</label>
        <input id="b-name" name="name" className="glass-input" defaultValue={state.values?.name ?? defaults.name} required />
      </div>
      <div>
        <label className="glass-label" htmlFor="b-address">Endereço completo</label>
        <input id="b-address" name="address" className="glass-input" placeholder="Rua, número, bairro, cidade - UF, CEP" defaultValue={state.values?.address ?? defaults.address} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton>
    </form>
  );
}

export function RulesForm({ defaults }: { defaults: { pointsPerReal: number; maxRedeemsPerMonth: number } }) {
  const [state, action] = useActionState(saveRules, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="r-ppr">Pontos a cada R$ 1,00 gasto</label>
          <input id="r-ppr" name="pointsPerReal" type="number" min={1} max={1000} step={1} inputMode="numeric" className="glass-input" defaultValue={state.values?.pointsPerReal ?? defaults.pointsPerReal} required />
          <p className="mt-1 text-xs text-slate-500">Ex.: 10 → R$ 150,00 vira 1.500 pontos.</p>
        </div>
        <div>
          <label className="glass-label" htmlFor="r-max">Máx. de resgates por CPF/mês</label>
          <input id="r-max" name="maxRedeemsPerMonth" type="number" min={1} max={100} step={1} inputMode="numeric" className="glass-input" defaultValue={state.values?.maxRedeemsPerMonth ?? defaults.maxRedeemsPerMonth} required />
          <p className="mt-1 text-xs text-slate-500">Trava de segurança contra abuso.</p>
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar regras</SubmitButton>
    </form>
  );
}

export function AddInteractionForm() {
  const [state, action] = useActionState(addInteraction, {});
  return (
    <form action={action} className="space-y-3" key={state.ok ?? 'idle'}>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <input name="label" defaultValue={state.values?.label} className="glass-input" placeholder="Ex.: Story no Instagram" aria-label="Descrição da interação" required />
        <input name="points" defaultValue={state.values?.points} type="number" min={1} inputMode="numeric" className="glass-input" placeholder="Pontos" aria-label="Pontos da interação" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Adicionando…">Adicionar interação</SubmitButton>
    </form>
  );
}

export function AddRewardForm() {
  const [state, action] = useActionState(addReward, {});
  return (
    <form action={action} className="space-y-3" key={state.ok ?? 'idle'}>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <input name="name" defaultValue={state.values?.name} className="glass-input" placeholder="Ex.: Sobremesa grátis" aria-label="Nome do produto" required />
        <input name="pointsCost" defaultValue={state.values?.pointsCost} type="number" min={1} inputMode="numeric" className="glass-input" placeholder="Pontos" aria-label="Custo em pontos" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Adicionando…">Adicionar produto</SubmitButton>
    </form>
  );
}

export function FinishOnboardingForm() {
  const [state, action] = useActionState(finishOnboarding, {});
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton pendingText="Finalizando…">Concluir configuração e ir para o caixa</SubmitButton>
    </form>
  );
}
