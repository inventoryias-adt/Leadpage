'use client';

import { useActionState, useState } from 'react';
import {
  acceptInvite,
  adminCreateRestaurant,
  adminLogin,
  adminResetPassword,
  adminSaveNote,
  adminSetStatus,
  adminUpdateRestaurant,
  type CreateState,
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

type StatusTarget = 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

const TARGET_COPY: Record<StatusTarget, { title: (n: string) => string; text: string; confirm: string; done: string }> = {
  PAST_DUE: {
    title: (n) => `Suspender o acesso de ${n}?`,
    text: 'O dono volta para a tela de pagamento e o lugar some da vitrine dos clientes. Nada é apagado: clientes, pontos e configurações ficam guardados. Você pode reativar quando quiser.',
    confirm: 'Sim, suspender acesso',
    done: 'Acesso suspenso.',
  },
  CANCELED: {
    title: (n) => `Cancelar a assinatura de ${n}?`,
    text: 'O painel e a vitrine ficam bloqueados para essa conta. Nada é apagado: clientes, pontos e configurações são mantidos, e você pode reativar depois.',
    confirm: 'Sim, cancelar assinatura',
    done: 'Assinatura cancelada.',
  },
  ACTIVE: {
    title: (n) => `Liberar o acesso de ${n}?`,
    text: 'O painel e a vitrine voltam a funcionar na hora. Use quando o pagamento foi feito por fora (Pix, transferência) ou para dar uma cortesia.',
    confirm: 'Sim, liberar acesso',
    done: 'Acesso liberado.',
  },
};

/** Botões claros no topo da ficha: o que dá para fazer com a assinatura agora, cada um com confirmação. */
export function StatusActions({ id, current, name }: { id: string; current: string; name: string }) {
  const [target, setTarget] = useState<StatusTarget | null>(null);
  const buttons: { to: StatusTarget; label: string; cls: string }[] =
    current === 'ACTIVE'
      ? [{ to: 'PAST_DUE', label: 'Suspender acesso', cls: 'glass-button-ghost btn-sm' }, { to: 'CANCELED', label: 'Cancelar assinatura', cls: 'btn-danger btn-sm' }]
      : current === 'PENDING'
        ? [{ to: 'ACTIVE', label: 'Liberar acesso (já pagou)', cls: 'glass-button btn-sm' }, { to: 'CANCELED', label: 'Cancelar assinatura', cls: 'btn-danger btn-sm' }]
        : current === 'PAST_DUE'
          ? [{ to: 'ACTIVE', label: 'Reativar', cls: 'glass-button btn-sm' }, { to: 'CANCELED', label: 'Cancelar assinatura', cls: 'btn-danger btn-sm' }]
          : [{ to: 'ACTIVE', label: 'Reativar assinatura', cls: 'glass-button btn-sm' }];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button key={b.to} type="button" className={b.cls} onClick={() => setTarget(b.to)} aria-haspopup="dialog">
            {b.label}
          </button>
        ))}
      </div>
      {target && <StatusDialog id={id} name={name} target={target} onClose={() => setTarget(null)} />}
    </>
  );
}

/** Montado só enquanto aberto: cada abertura começa com o estado limpo. */
function StatusDialog({ id, name, target, onClose }: { id: string; name: string; target: StatusTarget; onClose: () => void }) {
  const [state, action] = useActionState(adminSetStatus, {});
  const copy = TARGET_COPY[target];
  const finished = !!state.ok;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:items-center md:p-6" onClick={() => !finished && onClose()}>
      <form
        action={action}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-fade-in space-y-4 rounded-t-3xl bg-white p-6 shadow-2xl md:rounded-3xl"
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={target} />
        <h2 id="status-title" className="text-xl font-semibold text-primary">{copy.title(name)}</h2>
        {finished ? (
          <>
            <p role="status" className="glass-success">{copy.done}</p>
            <button type="button" className="glass-button" onClick={onClose}>Fechar</button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">{copy.text}</p>
            <div>
              <label className="glass-label" htmlFor="status-reason">Motivo <span className="font-normal text-slate-500">(fica no registro)</span></label>
              <input id="status-reason" name="reason" className="glass-input" maxLength={200} placeholder="Ex.: pediu para cancelar, pagou por Pix" />
            </div>
            {state.error && <p role="alert" className="glass-error">{state.error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="glass-button-ghost" onClick={onClose}>Voltar</button>
              <SubmitButton variant={target === 'CANCELED' ? 'ghost' : 'primary'} pendingText="Salvando…" className={target === 'CANCELED' ? '!border-red-600 !bg-red-600 !text-white hover:!bg-white hover:!text-red-600' : ''}>
                {copy.confirm}
              </SubmitButton>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

/** Nova conta de assinante criada pela administração. Mostra a senha temporária uma única vez. */
export function CreateForm() {
  const [state, action] = useActionState<CreateState, FormData>(adminCreateRestaurant, {});
  const [copied, setCopied] = useState(false);
  if (state.created) {
    const c = state.created;
    return (
      <div className="space-y-4" role="status">
        <p className="glass-success">Conta criada: <strong>{c.name}</strong> ({c.status}).</p>
        <div className="glass-inset space-y-1 p-4">
          <p className="text-xs font-semibold text-slate-500">Entrada do dono</p>
          <p className="text-sm text-slate-700">E-mail: <strong>{c.email}</strong></p>
          <p className="text-sm text-slate-700">Senha temporária: <span className="font-mono text-lg font-bold tracking-wider text-primary" data-testid="new-password">{c.password}</span></p>
          <p className="text-xs text-slate-500">Ela só aparece agora. Passe por um canal seguro; o dono pode trocá-la em Regras → Minha conta.</p>
          <button
            type="button"
            className="glass-button-ghost btn-sm mt-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`E-mail: ${c.email}\nSenha temporária: ${c.password}`);
                setCopied(true);
              } catch {
                /* os dados seguem visíveis na tela */
              }
            }}
          >
            <Icon name="copy" size={16} /> {copied ? 'Copiado!' : 'Copiar e-mail e senha'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/assinantes/${c.id}`} className="glass-button btn-sm">Abrir a ficha</a>
          <a href="/admin/assinantes/novo" className="glass-button-ghost btn-sm">Criar outra conta</a>
        </div>
      </div>
    );
  }
  const v = state.values;
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor="n-name">Nome do estabelecimento</label>
          <input id="n-name" name="name" className="glass-input" defaultValue={v?.name} maxLength={80} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="n-email">E-mail de acesso</label>
          <input id="n-email" name="email" type="email" className="glass-input" defaultValue={v?.email} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="n-phone">Telefone / WhatsApp</label>
          <input id="n-phone" name="phone" inputMode="tel" className="glass-input" placeholder="(11) 91234-5678" defaultValue={v?.phone} required />
        </div>
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor="n-status">Assinatura</label>
          <select id="n-status" name="status" className="glass-input" defaultValue={v?.status ?? 'ACTIVE'}>
            <option value="ACTIVE">Ativa (já pagou por fora ou cortesia)</option>
            <option value="PENDING">Aguardando pagamento (o dono paga ao entrar)</option>
          </select>
        </div>
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="isTest" defaultChecked={v?.isTest === 'on'} className="mt-0.5 h-5 w-5 rounded accent-electric-500" />
        <span className="text-sm text-slate-700"><span className="font-semibold">Conta de teste</span> — fica fora da receita e dos números de assinantes.</span>
      </label>
      <p className="text-xs text-slate-500">Uma senha temporária é gerada e mostrada uma única vez, depois de criar.</p>
      {state.error && <p role="alert" className="glass-error">{state.error}</p>}
      <SubmitButton pendingText="Criando…">Criar conta</SubmitButton>
    </form>
  );
}

type Editable = { id: string; name: string; phone: string; pointsPerReal: number; maxRedeemsPerMonth: number; checkInPoints: number; referralPoints: number; listed: boolean; isTest: boolean };

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
      <label className="flex items-start gap-3">
        <input type="checkbox" name="isTest" defaultChecked={v ? v.isTest === 'on' : r.isTest} className="mt-0.5 h-5 w-5 rounded accent-electric-500" />
        <span className="text-sm text-slate-700"><span className="font-semibold">Conta de teste</span> — fica fora da receita e dos números de assinantes. Para esconder da vitrine dos clientes, desmarque a opção acima.</span>
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
