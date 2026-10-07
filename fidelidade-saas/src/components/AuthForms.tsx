'use client';

import { useActionState } from 'react';
import { login, signup } from '@/app/actions/auth';
import { customerAuth } from '@/app/actions/customer';
import { FormMessage, SubmitButton } from './ui';
import { MaskedInput } from './MaskedInput';

export function SignupForm() {
  const [state, action] = useActionState(signup, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="glass-label" htmlFor="name">Nome do estabelecimento</label>
        <input id="name" name="name" defaultValue={state.values?.name} className="glass-input" placeholder="Ex: Burger do Zé" autoComplete="organization" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="email">E-mail profissional</label>
        <input id="email" name="email" type="email" defaultValue={state.values?.email} className="glass-input" placeholder="contato@restaurante.com" autoComplete="email" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="phone">Telefone / WhatsApp</label>
        <MaskedInput mask="phone" id="phone" name="phone" type="tel" defaultValue={state.values?.phone} placeholder="(11) 91234-5678" autoComplete="tel" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" className="glass-input" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" minLength={8} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Criando conta…" className="mt-2">Ir para pagamento seguro</SubmitButton>
      <p className="text-center text-xs text-slate-500">
        Ao continuar você concorda com os termos de uso. Pagamento processado em ambiente seguro.
      </p>
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(login, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="glass-label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" defaultValue={state.values?.email} className="glass-input" autoComplete="email" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" className="glass-input" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}

/** Login/cadastro rápido do cliente final (CPF + telefone). Com `token`, já credita o QR Code. */
export function CustomerAuthForm({
  token,
  next,
  cta,
}: {
  token?: string;
  next?: string;
  cta: string;
}) {
  const [state, action] = useActionState(customerAuth, {});
  return (
    <form action={action} className="space-y-4">
      {token && <input type="hidden" name="token" value={token} />}
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="glass-label" htmlFor="cpf">CPF</label>
        <MaskedInput mask="cpf" id="cpf" name="cpf" defaultValue={state.values?.cpf} placeholder="000.000.000-00" autoComplete="off" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="phone">Telefone</label>
        <MaskedInput mask="phone" id="phone" name="phone" type="tel" defaultValue={state.values?.phone} placeholder="(11) 91234-5678" autoComplete="tel" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="name">
          Nome <span className="font-normal text-slate-500">(só no primeiro acesso)</span>
        </label>
        <input id="name" name="name" defaultValue={state.values?.name} className="glass-input" placeholder="Como podemos te chamar?" autoComplete="given-name" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Aguarde…">{cta}</SubmitButton>
    </form>
  );
}
