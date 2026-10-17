'use client';

import { useActionState, useState } from 'react';
import { submitLead } from '@/app/actions/lead';
import { UFS } from '@/lib/address';
import { CATEGORIES } from '@/lib/categories';
import { FormMessage, SubmitButton, maskPhoneInput } from './ui';

/** Formulário "Quero o Fidelize no meu negócio": o comerciante deixa o contato e a gente chama. */
export function LeadForm({ source }: { source: string }) {
  const [state, action] = useActionState(submitLead, {});
  const [category, setCategory] = useState(state.values?.category ?? '');
  const [phone, setPhone] = useState(state.values?.phone ?? '');

  if (state.ok) {
    return (
      <div role="status" data-testid="lead-ok" className="rounded-3xl bg-emerald-50 p-6 text-center">
        <p className="text-4xl">✓</p>
        <p className="mt-2 text-lg font-bold text-emerald-800">Contato enviado!</p>
        <p className="mt-1 text-sm text-emerald-700">{state.ok}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" autoComplete="on">
      <input type="hidden" name="source" value={source} />
      {/* campo-isca: escondido de quem usa a tela, robôs costumam preencher */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Não preencha este campo<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="l-name">Seu nome</label>
          <input id="l-name" name="name" className="glass-input" autoComplete="name" defaultValue={state.values?.name} maxLength={80} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="l-business">Nome do seu negócio</label>
          <input id="l-business" name="business" className="glass-input" autoComplete="organization" defaultValue={state.values?.business} maxLength={80} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="l-phone">WhatsApp ou telefone</label>
          <input id="l-phone" name="phone" type="tel" inputMode="numeric" className="glass-input" placeholder="(11) 91234-5678" autoComplete="tel" value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="l-email">E-mail</label>
          <input id="l-email" name="email" type="email" className="glass-input" autoComplete="email" defaultValue={state.values?.email} maxLength={120} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="l-city">Cidade</label>
          <input id="l-city" name="city" className="glass-input" autoComplete="address-level2" defaultValue={state.values?.city} maxLength={60} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="l-state">Estado</label>
          <select id="l-state" name="state" className="glass-input" defaultValue={state.values?.state ?? ''}>
            <option value="">Escolha…</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className={category === 'outros' ? '' : 'sm:col-span-2'}>
          <label className="glass-label" htmlFor="l-category">Ramo do negócio</label>
          <select id="l-category" name="category" className="glass-input" defaultValue={state.values?.category ?? ''} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">Escolha o ramo…</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        {category === 'outros' && (
          <div>
            <label className="glass-label" htmlFor="l-other">Qual é o ramo?</label>
            <input id="l-other" name="categoryOther" className="glass-input" placeholder="Ex.: doceria, ótica…" defaultValue={state.values?.categoryOther} maxLength={60} />
          </div>
        )}
      </div>
      <div>
        <label className="glass-label" htmlFor="l-msg">Quer contar mais? <span className="font-normal text-slate-500">— opcional</span></label>
        <textarea id="l-msg" name="message" rows={3} maxLength={400} className="glass-input" placeholder="Quantas unidades, como vende hoje, alguma dúvida…" defaultValue={state.values?.message} />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="lime" pendingText="Enviando…" data-testid="lead-enviar">Quero o Fidelize no meu negócio</SubmitButton>
      <p className="text-center text-xs text-slate-500">Usamos o seu contato só para falar sobre o Fidelize. Sem compromisso.</p>
    </form>
  );
}
