'use client';

import { useActionState, useState } from 'react';
import { changeCustomerPassword, saveCustomerContact, saveCustomerCpf, saveCustomerName } from '@/app/actions/customer';
import { FormMessage, SubmitButton, maskCpfInput, maskPhoneInput } from './ui';

function Card({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="glass-panel-sm space-y-3 p-4" data-testid={`data-${id}`}>
      <div>
        <h2 id={id} className="font-bold text-slate-800">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function PasswordField({ hint }: { hint?: string }) {
  return (
    <div>
      <label className="glass-label" htmlFor="cf-password">Sua senha atual <span className="font-normal text-slate-500">— para confirmar</span></label>
      <input id="cf-password" name="password" type="password" autoComplete="current-password" className="glass-input" />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Nome que aparece no cartão, nas indicações (só o primeiro nome e a inicial) e nas avaliações. */
export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState(saveCustomerName, {});
  return (
    <Card id="nome" title="Nome" hint="Como você quer ser chamado. Aparece no cartão e, abreviado, nas suas indicações e avaliações.">
      <form action={action} className="flex items-start gap-2" autoComplete="off">
        <div className="min-w-0 flex-1">
          <label htmlFor="cf-name" className="sr-only">Seu nome</label>
          <input id="cf-name" name="name" defaultValue={state.values?.name ?? name} maxLength={80} required className="glass-input" autoComplete="name" />
        </div>
        <SubmitButton pendingText="Salvando…" className="btn-sm !w-auto shrink-0 px-5" data-testid="save-name">Salvar</SubmitButton>
      </form>
      <FormMessage state={state} />
    </Card>
  );
}

/** Telefone e e-mail de acesso. Quem tem senha confirma com ela. */
export function ContactForm({ phone, email, needsPassword }: { phone: string; email: string | null; needsPassword: boolean }) {
  const [state, action] = useActionState(saveCustomerContact, {});
  const [ph, setPh] = useState(maskPhoneInput(state.values?.phone ?? phone));
  return (
    <Card id="contato" title="Telefone e e-mail" hint="O e-mail é o seu acesso ao app. O telefone ajuda a recuperar a conta.">
      <form action={action} className="space-y-3" autoComplete="off">
        <div>
          <label className="glass-label" htmlFor="cf-phone">Telefone (com DDD)</label>
          <input id="cf-phone" name="phone" inputMode="tel" value={ph} onChange={(e) => setPh(maskPhoneInput(e.target.value))} className="glass-input" autoComplete="tel" required />
        </div>
        {email ? (
          <div>
            <label className="glass-label" htmlFor="cf-email">E-mail</label>
            <input id="cf-email" name="email" type="email" defaultValue={state.values?.email ?? email} className="glass-input" autoComplete="email" required />
          </div>
        ) : (
          <p className="text-xs text-slate-500">Sua conta ainda não tem acesso com e-mail e senha. Saia e use “Já tenho cadastro” para criar.</p>
        )}
        {needsPassword && <PasswordField />}
        <FormMessage state={state} />
        <SubmitButton pendingText="Salvando…" className="btn-sm !w-auto px-5" data-testid="save-contact">Salvar</SubmitButton>
      </form>
    </Card>
  );
}

/** CPF da conta (corrigir um cadastro errado). Único, e o caixa usa no lugar do ID da conta. */
export function CpfForm({ cpfMasked, needsPassword }: { cpfMasked: string; needsPassword: boolean }) {
  const [state, action] = useActionState(saveCustomerCpf, {});
  const [cpf, setCpf] = useState(maskCpfInput(state.values?.cpf ?? ''));
  return (
    <Card id="cpf" title="CPF" hint={`CPF atual: ${cpfMasked}. Só corrija se o cadastro foi feito errado: o CPF é a sua identidade nos lugares do clube.`}>
      <form action={action} className="space-y-3" autoComplete="off">
        <div>
          <label className="glass-label" htmlFor="cf-cpf">Novo CPF</label>
          <input id="cf-cpf" name="cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(maskCpfInput(e.target.value))} placeholder="000.000.000-00" className="glass-input" required />
        </div>
        {needsPassword && <PasswordField hint="Dá para corrigir o CPF poucas vezes por mês." />}
        <FormMessage state={state} />
        <SubmitButton pendingText="Salvando…" variant="ghost" className="btn-sm !w-auto px-5" data-testid="save-cpf">Trocar CPF</SubmitButton>
      </form>
    </Card>
  );
}

/** Troca de senha. */
export function PasswordForm() {
  const [state, action] = useActionState(changeCustomerPassword, {});
  return (
    <Card id="senha" title="Senha" hint="Use pelo menos 8 caracteres.">
      <form action={action} className="space-y-3" autoComplete="off" key={state.ok ?? 'idle'}>
        <div>
          <label className="glass-label" htmlFor="pw-current">Senha atual</label>
          <input id="pw-current" name="password" type="password" autoComplete="current-password" className="glass-input" required />
        </div>
        <div>
          <label className="glass-label" htmlFor="pw-next">Nova senha</label>
          <input id="pw-next" name="next" type="password" autoComplete="new-password" minLength={8} className="glass-input" required />
        </div>
        <div>
          <label className="glass-label" htmlFor="pw-confirm">Repita a nova senha</label>
          <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} className="glass-input" required />
        </div>
        <FormMessage state={state} />
        <SubmitButton pendingText="Salvando…" variant="ghost" className="btn-sm !w-auto px-5" data-testid="save-password">Trocar senha</SubmitButton>
      </form>
    </Card>
  );
}
