'use client';

import { useActionState, useState } from 'react';
import {
  acceptInvite,
  adminLogin,
  adminResetPassword,
  adminSaveNote,
  adminSetStatus,
  adminUpdateRestaurant,
  type ResetState,
} from '@/app/actions/admin';
import { FormMessage, SubmitButton } from './ui';
import { Icon } from './Icons';

export function AdminLoginForm() {
  const [state, action] = useActionState(adminLogin, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="glass-label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" className="glass-input" defaultValue={state.values?.email} autoComplete="username" required />
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

export function InviteForm({ token, name }: { token: string; name: string }) {
  const [state, action] = useActionState(acceptInvite, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-slate-600">Olá, <strong className="text-primary">{name}</strong>. Crie a sua senha de administrador: 10 caracteres ou mais, com letras e números.</p>
      <div>
        <label className="glass-label" htmlFor="password">Nova senha</label>
        <input id="password" name="password" type="password" className="glass-input" autoComplete="new-password" minLength={10} required />
      </div>
      <div>
        <label className="glass-label" htmlFor="confirm">Repita a senha</label>
        <input id="confirm" name="confirm" type="password" className="glass-input" autoComplete="new-password" minLength={10} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Criar senha e entrar</SubmitButton>
    </form>
  );
}

const STATUSES = [
  ['ACTIVE', 'Ativa'],
  ['PENDING', 'Aguardando pagamento'],
  ['PAST_DUE', 'Inadimplente'],
  ['CANCELED', 'Cancelada'],
] as const;

export function StatusForm({ id, current }: { id: string; current: string }) {
  const [state, action] = useActionState(adminSetStatus, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="status">Status da assinatura</label>
          <select id="status" name="status" className="glass-input" defaultValue={state.values?.status ?? current}>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor="reason">Motivo <span className="font-normal text-slate-500">(fica no registro)</span></label>
          <input id="reason" name="reason" className="glass-input" placeholder="Ex.: pagamento por Pix, cortesia de 30 dias" defaultValue={state.values?.reason} maxLength={200} />
        </div>
      </div>
      <p className="text-xs text-slate-500">“Ativa” libera o painel e a vitrine; qualquer outro status leva o dono de volta ao pagamento.</p>
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Salvando…" className="!w-auto">Alterar status</SubmitButton>
    </form>
  );
}

type Editable = { id: string; name: string; phone: string; pointsPerReal: number; maxRedeemsPerMonth: number; checkInPoints: number; referralPoints: number; listed: boolean };

export function EditForm({ r }: { r: Editable }) {
  const [state, action] = useActionState(adminUpdateRestaurant, {});
  const v = state.values;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={r.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor="e-name">Nome do estabelecimento</label>
          <input id="e-name" name="name" className="glass-input" defaultValue={v?.name ?? r.name} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="e-phone">Telefone</label>
          <input id="e-phone" name="phone" className="glass-input" inputMode="tel" defaultValue={v?.phone ?? r.phone} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="e-ppr">Pontos a cada R$ 1,00</label>
          <input id="e-ppr" name="pointsPerReal" type="number" min={1} max={1000} className="glass-input" defaultValue={v?.pointsPerReal ?? r.pointsPerReal} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="e-max">Resgates por CPF/mês</label>
          <input id="e-max" name="maxRedeemsPerMonth" type="number" min={1} max={100} className="glass-input" defaultValue={v?.maxRedeemsPerMonth ?? r.maxRedeemsPerMonth} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="e-ci">Pontos por check-in</label>
          <input id="e-ci" name="checkInPoints" type="number" min={0} max={1000} className="glass-input" defaultValue={v?.checkInPoints ?? r.checkInPoints} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="e-ref">Pontos por indicação</label>
          <input id="e-ref" name="referralPoints" type="number" min={0} max={100000} className="glass-input" defaultValue={v?.referralPoints ?? r.referralPoints} required />
        </div>
      </div>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="listed" defaultChecked={v ? v.listed === 'on' : r.listed} className="h-5 w-5 rounded accent-electric-500" />
        <span className="text-sm text-slate-700"><span className="font-semibold">Aparece na vitrine “Lugares”</span></span>
      </label>
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Salvando…" className="!w-auto">Salvar dados</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action] = useActionState<ResetState, FormData>(adminResetPassword, {});
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="space-y-3" onSubmit={() => setCopied(false)}>
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-slate-600">Gera uma senha temporária para o dono entrar. Ela aparece <strong>uma única vez</strong>; passe por um canal seguro e peça para ele trocar depois.</p>
      {state.error && <p role="alert" className="glass-error">{state.error}</p>}
      {state.password && (
        <div className="glass-inset p-3" role="status">
          <p className="text-xs font-semibold text-slate-500">Senha temporária</p>
          <p className="font-mono text-xl font-bold tracking-wider text-primary" data-testid="temp-password">{state.password}</p>
          <button
            type="button"
            className="glass-button-ghost btn-sm mt-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.password ?? '');
                setCopied(true);
              } catch {
                /* a senha segue visível na tela */
              }
            }}
          >
            <Icon name="copy" size={16} /> {copied ? 'Copiada!' : 'Copiar'}
          </button>
        </div>
      )}
      <SubmitButton variant="ghost" pendingText="Gerando…" className="!w-auto">Gerar senha temporária</SubmitButton>
    </form>
  );
}

export function NoteForm({ id, note }: { id: string; note: string }) {
  const [state, action] = useActionState(adminSaveNote, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="glass-label" htmlFor="note">Anotação interna <span className="font-normal text-slate-500">(o dono não vê)</span></label>
      <textarea id="note" name="note" rows={4} maxLength={2000} className="glass-input" defaultValue={state.values?.note ?? note} placeholder="Combinados, pagamentos fora do sistema, pedidos de suporte…" />
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Salvando…" className="!w-auto">Salvar anotação</SubmitButton>
    </form>
  );
}
