'use client';

import { useActionState, useState } from 'react';
import { login, signup } from '@/app/actions/auth';
import { customerLogin, customerRecover, customerSignup } from '@/app/actions/customer';
import { FormMessage, SubmitButton } from './ui';
import { MaskedInput } from './MaskedInput';

export function SignupForm() {
  const [state, action] = useActionState(signup, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="glass-label" htmlFor="name">Nome do estabelecimento</label>
        <input id="name" name="name" defaultValue={state.values?.name} className="glass-input" placeholder="Ex.: Burger do Zé" autoComplete="off" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="email">E-mail profissional</label>
        <input id="email" name="email" type="email" defaultValue={state.values?.email} className="glass-input" placeholder="contato@restaurante.com" autoComplete="off" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="phone">Telefone / WhatsApp</label>
        <MaskedInput mask="phone" id="phone" name="phone" type="tel" defaultValue={state.values?.phone} placeholder="(11) 91234-5678" autoComplete="off" required />
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
        <input id="email" name="email" type="email" defaultValue={state.values?.email} className="glass-input" autoComplete="username" required />
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

type Mode = 'entrar' | 'criar' | 'recuperar';

/**
 * Acesso do cliente final: entrar (e-mail e senha), criar conta ou, para quem já tinha cadastro por CPF e
 * telefone, criar o acesso (também serve para redefinir a senha). Com `token`, já credita o QR Code.
 */
export function CustomerAuthForm({
  token,
  next,
  cta,
  invite,
  initial = 'entrar',
}: {
  token?: string;
  next?: string;
  cta: string;
  invite?: { restaurantId: string; code: string };
  initial?: 'entrar' | 'criar';
}) {
  const [mode, setMode] = useState<Mode>(initial);
  const hidden = (
    <>
      {token && <input type="hidden" name="token" value={token} />}
      {next && <input type="hidden" name="next" value={next} />}
      {invite && (
        <>
          <input type="hidden" name="inviteRestaurant" value={invite.restaurantId} />
          <input type="hidden" name="inviteCode" value={invite.code} />
        </>
      )}
    </>
  );
  const tab = (m: 'entrar' | 'criar', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition-colors ${mode === m ? 'bg-primary text-white' : 'text-slate-600 hover:bg-white'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {mode !== 'recuperar' ? (
        <div role="tablist" aria-label="Entrar ou criar conta" className="flex gap-1 rounded-md bg-slate-100 p-1">
          {tab('entrar', 'Entrar')}
          {tab('criar', 'Criar conta')}
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-bold text-primary">Já tenho cadastro</h2>
          <p className="text-sm text-slate-500">Confirme seu CPF e telefone e crie seu e-mail e senha. Serve também se você esqueceu a senha.</p>
        </div>
      )}
      {mode === 'entrar' && <LoginPane hidden={hidden} cta={cta} onRecover={() => setMode('recuperar')} />}
      {mode === 'criar' && <SignupPane hidden={hidden} cta={cta === 'Entrar' ? 'Criar minha conta' : cta} />}
      {mode === 'recuperar' && <RecoverPane hidden={hidden} onBack={() => setMode('entrar')} />}
    </div>
  );
}

function LoginPane({ hidden, cta, onRecover }: { hidden: React.ReactNode; cta: string; onRecover: () => void }) {
  const [state, action] = useActionState(customerLogin, {});
  return (
    <form action={action} className="space-y-4">
      {hidden}
      <div>
        <label className="glass-label" htmlFor="c-email">E-mail</label>
        <input id="c-email" name="email" type="email" defaultValue={state.values?.email} className="glass-input" placeholder="voce@email.com" autoComplete="username" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="c-password">Senha</label>
        <input id="c-password" name="password" type="password" className="glass-input" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Entrando…">{cta}</SubmitButton>
      <p className="text-center text-sm text-slate-600">
        Já tinha cadastro com CPF e telefone?{' '}
        <button type="button" onClick={onRecover} className="link-inline font-semibold">Crie seu e-mail e senha</button>
      </p>
    </form>
  );
}

function SignupPane({ hidden, cta }: { hidden: React.ReactNode; cta: string }) {
  const [state, action] = useActionState(customerSignup, {});
  return (
    <form action={action} className="space-y-4">
      {hidden}
      <div>
        <label className="glass-label" htmlFor="s-name">Nome</label>
        <input id="s-name" name="name" defaultValue={state.values?.name} className="glass-input" placeholder="Como podemos te chamar?" autoComplete="off" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="s-cpf">CPF</label>
        <MaskedInput mask="cpf" id="s-cpf" name="cpf" defaultValue={state.values?.cpf} placeholder="000.000.000-00" autoComplete="off" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="s-phone">Telefone</label>
        <MaskedInput mask="phone" id="s-phone" name="phone" type="tel" defaultValue={state.values?.phone} placeholder="(11) 91234-5678" autoComplete="off" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="s-email">E-mail</label>
        <input id="s-email" name="email" type="email" defaultValue={state.values?.email} className="glass-input" placeholder="voce@email.com" autoComplete="username" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="s-password">Senha</label>
        <input id="s-password" name="password" type="password" className="glass-input" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" minLength={8} maxLength={72} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Criando conta…">{cta}</SubmitButton>
    </form>
  );
}

function RecoverPane({ hidden, onBack }: { hidden: React.ReactNode; onBack: () => void }) {
  const [state, action] = useActionState(customerRecover, {});
  return (
    <form action={action} className="space-y-4">
      {hidden}
      <div>
        <label className="glass-label" htmlFor="r-cpf">CPF</label>
        <MaskedInput mask="cpf" id="r-cpf" name="cpf" defaultValue={state.values?.cpf} placeholder="000.000.000-00" autoComplete="off" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="r-phone">Telefone cadastrado</label>
        <MaskedInput mask="phone" id="r-phone" name="phone" type="tel" defaultValue={state.values?.phone} placeholder="(11) 91234-5678" autoComplete="off" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="r-email">E-mail</label>
        <input id="r-email" name="email" type="email" defaultValue={state.values?.email} className="glass-input" placeholder="voce@email.com" autoComplete="username" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="r-password">Nova senha</label>
        <input id="r-password" name="password" type="password" className="glass-input" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" minLength={8} maxLength={72} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Criar acesso e entrar</SubmitButton>
      <p className="text-center text-sm">
        <button type="button" onClick={onBack} className="link-inline font-semibold">Voltar</button>
      </p>
    </form>
  );
}
