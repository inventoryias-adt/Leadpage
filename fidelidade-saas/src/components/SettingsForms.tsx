'use client';

import Link from 'next/link';
import { APPROVALS, APPROVAL_LABEL } from '@/lib/interaction-approval';
import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import {
  addInteraction,
  updateInteraction,
  addReward,
  finishOnboarding,
  saveBasics,
  saveCategory,
  saveEngagement,
  saveSharing,
  saveIdentity,
  saveRules,
  saveUnit,
  setRewardImage,
  updateReward,
} from '@/app/actions/restaurant';
import { changePassword, openBillingPortal } from '@/app/actions/auth';
import { UFS, cepDigits, maskCep, parseViaCep } from '@/lib/address';
import { suggestsBooking } from '@/lib/categories';
import { CATEGORIES, CATEGORY_HINT } from '@/lib/categories';
import { categoryRequestMessage, buildSupport, type SupportContact } from '@/lib/support';
import { SupportLinks } from './SupportLinks';
import { defaultSchedule, parseSchedule, type Schedule } from '@/lib/hours';
import { HoursGrid } from './HoursGrid';
import { UnitLocationField } from './UnitLocationField';
import { Icon } from './Icons';
import { CHECKIN_RADIUS_OPTIONS, radiusIndex } from '@/lib/geo';
import { ImageUpload, shrinkImage } from './ImageUpload';
import { WebImageSearch } from './WebImageSearch';
import { PreviewFrame } from './PreviewFrame';
import { RewardImage, ProgressBar } from './Visual';
import { formatPoints, formatPrice } from '@/lib/points';
import { FormMessage, SubmitButton } from './ui';

type Basics = { name: string };

/** Chave liga/desliga (marinho com a bolinha lima quando ligada). */
function Switch({ on, onChange, label, id }: { on: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? 'Ligado: toque para desligar' : 'Desligado: toque para ligar'}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600 ${on ? 'bg-[#0f1f3d]' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full shadow transition-transform ${on ? 'translate-x-[26px] bg-[#c6f432]' : 'translate-x-1 bg-white'}`} />
    </button>
  );
}

export function BasicsForm({ defaults }: { defaults: Basics }) {
  const [state, action] = useActionState(saveBasics, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid items-end gap-3 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="b-name">Nome do estabelecimento</label>
          <input id="b-name" name="name" className="glass-input" defaultValue={state.values?.name ?? defaults.name} required />
        </div>
        <div>
          <SubmitButton pendingText="Salvando…" className="btn-sm">Salvar nome</SubmitButton>
        </div>
      </div>
      <p className="text-xs text-slate-500">É o nome que o cliente vê. Endereço e horário ficam em cada unidade.</p>
      <FormMessage state={state} />
    </form>
  );
}

export function RulesForm({ defaults }: { defaults: { pointsPerReal: number; maxRedeemsPerMonth: number } }) {
  const [state, action] = useActionState(saveRules, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_auto]">
        <div>
          <label className="glass-label" htmlFor="r-ppr">Pontos a cada R$ 1,00 gasto</label>
          <input id="r-ppr" name="pointsPerReal" type="number" min={1} max={1000} step={1} inputMode="numeric" className="glass-input" defaultValue={state.values?.pointsPerReal ?? defaults.pointsPerReal} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="r-max">Máx. de resgates por CPF/mês</label>
          <input id="r-max" name="maxRedeemsPerMonth" type="number" min={1} max={100} step={1} inputMode="numeric" className="glass-input" defaultValue={state.values?.maxRedeemsPerMonth ?? defaults.maxRedeemsPerMonth} required />
        </div>
        <div>
          <SubmitButton pendingText="Salvando…" className="btn-sm">Salvar regras</SubmitButton>
        </div>
      </div>
      <p className="text-xs text-slate-500">Ex.: com 10 pontos por real, R$ 150,00 viram 1.500 pontos. O limite de resgates por mês é uma trava de segurança contra abuso.</p>
      <FormMessage state={state} />
    </form>
  );
}

/** Como os pontos da interação são confirmados: só no balcão, aprovação do dono ou automática em 24 h. */
function ApprovalSelect({ id, value }: { id: string; value: string }) {
  return (
    <div>
      <label className="glass-label" htmlFor={id}>Como confirmar</label>
      <select id={id} name="approval" defaultValue={value} className="glass-input">
        {APPROVALS.map((a) => <option key={a} value={a}>{APPROVAL_LABEL[a]}</option>)}
      </select>
      <p className="mt-1 text-xs text-slate-500">Com “Eu aprovo” ou “Automático”, o cliente toca <b>Já fiz</b> no app e o pedido aparece no Caixa. Cada interação vale uma vez a cada 30 dias por cliente.</p>
    </div>
  );
}

/**
 * Linha de uma interação que dá pontos, com "Editar": muda a descrição e os pontos no lugar, sem apagar e criar de novo.
 * O botão de remover vem de fora (formulário do servidor).
 */
export function InteractionRow({ id, label, points, approval = 'COUNTER', remove }: { id: string; label: string; points: number; approval?: string; remove: React.ReactNode }) {
  const [state, action] = useActionState(updateInteraction, {});
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);
  return (
    <li className="py-3" data-testid="interaction-row">
      <div className="flex items-center gap-3">
        <span className="flex h-10 min-w-[3.5rem] shrink-0 items-center justify-center rounded-lg bg-[#E8EEFB] px-2 text-sm font-bold tabular-nums text-electric-600">+{points.toLocaleString('pt-BR')}</span>
        <span className="min-w-0 flex-1 text-sm leading-snug text-slate-800">{label}{approval !== 'COUNTER' && <span className="glass-chip ml-2 align-middle">{approval === 'AUTO' ? 'Automático em 24 h' : 'Você aprova'}</span>}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Editar ${label}`}
          title="Editar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
        >
          <Icon name="pencil" size={18} />
        </button>
        {remove}
      </div>
      {open && (
        <form action={action} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div>
              <label className="glass-label" htmlFor={`i-label-${id}`}>Descrição</label>
              <input id={`i-label-${id}`} name="label" defaultValue={state.values?.label ?? label} className="glass-input" required maxLength={80} />
            </div>
            <div>
              <label className="glass-label" htmlFor={`i-pts-${id}`}>Pontos</label>
              <input id={`i-pts-${id}`} name="points" type="number" min={1} inputMode="numeric" defaultValue={state.values?.points ?? points} className="glass-input" required />
            </div>
          </div>
          <ApprovalSelect id={`i-ap-${id}`} value={state.values?.approval ?? approval} />
          <p className="text-xs text-slate-500">A mudança vale daqui para frente; o que o cliente já ganhou não muda.</p>
          <FormMessage state={state} />
          <div className="flex gap-2">
            <SubmitButton pendingText="Salvando…" className="btn-sm">Salvar</SubmitButton>
            <button type="button" className="glass-button-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </li>
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
      <ApprovalSelect id="i-ap-novo" value={state.values?.approval ?? 'COUNTER'} />
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Adicionando…">Adicionar interação</SubmitButton>
    </form>
  );
}

export function AddRewardForm() {
  const [state, action] = useActionState(addReward, {});
  const [photo, setPhoto] = useState('');
  const [draft, setDraft] = useState({ name: '', points: '', cash: '' });
  useEffect(() => {
    if (state.ok) setDraft({ name: '', points: '', cash: '' });
  }, [state.ok]);
  const points = Math.max(0, parseInt(draft.points, 10) || 0);
  const cashCents = Math.round((parseFloat(draft.cash.replace(/\./g, '').replace(',', '.')) || 0) * 100);
  return (
    <form
      action={action}
      className="space-y-3"
      key={state.ok ?? 'idle'}
      onChange={(e) => {
        const fd = new FormData(e.currentTarget);
        setDraft({ name: String(fd.get('name') ?? ''), points: String(fd.get('pointsCost') ?? ''), cash: String(fd.get('cashValue') ?? '') });
      }}
    >
      <ImageUpload name="imageData" label="Foto do produto" hint="Opcional, mas aumenta muito a vontade de resgatar." maxSide={640} webSearch onPreview={setPhoto} />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <input name="name" defaultValue={state.values?.name} className="glass-input" placeholder="Ex.: Sobremesa grátis" aria-label="Nome do produto" required />
        <input name="pointsCost" defaultValue={state.values?.pointsCost} type="number" min={1} inputMode="numeric" className="glass-input" placeholder="Pontos" aria-label="Custo em pontos" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="rw-cash">Valor em R$ <span className="font-normal text-slate-500">(opcional — para produto com desconto)</span></label>
        <input id="rw-cash" name="cashValue" defaultValue={state.values?.cashValue} inputMode="decimal" className="glass-input sm:max-w-[12rem]" placeholder="Ex.: 8,00" />
        <p className="mt-1 text-xs text-slate-500">Deixe vazio para resgate só com pontos. Com valor, o cliente paga esse valor no balcão e dá os pontos. Faça a conta para ter certeza de que compensa.</p>
      </div>
      <input name="description" defaultValue={state.values?.description} className="glass-input" placeholder="Descrição curta (opcional)" aria-label="Descrição do produto" maxLength={160} />
      <PreviewFrame where="página do seu lugar → Prêmios, e na tela de resgate">
        <div className="glass-panel-sm flex items-center gap-3.5 p-3.5" data-testid="reward-preview">
          <RewardImage src={photo} name={draft.name || 'Seu produto'} className="h-16 w-16 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slate-800">{draft.name || 'Nome do produto'}</p>
            <p className="text-sm font-semibold text-electric-600">{points > 0 ? formatPrice(points, cashCents) : '— pts'}</p>
            {points > 0 && (
              <div className="mt-1.5">
                <ProgressBar value={Math.round(points * 0.4)} max={points} label="Exemplo de progresso" />
                <p className="mt-1 text-xs text-slate-500">Exemplo: {formatPoints(Math.round(points * 0.4))} / {formatPoints(points)} pts · faltam {formatPoints(points - Math.round(points * 0.4))}</p>
              </div>
            )}
          </div>
        </div>
        {!photo && <p className="mt-2 text-xs text-slate-500">Sem foto, o cliente vê o presente cinza. Com foto o resgate vende mais.</p>}
      </PreviewFrame>
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Adicionando…">Adicionar produto</SubmitButton>
    </form>
  );
}

/**
 * Foto de um produto já cadastrado, num passo só: "Trocar foto" abre a pasta do computador e salva assim que o
 * arquivo é escolhido; "Buscar na web" mostra fotos por nome ou código de barras e salva a escolhida.
 */
export function RewardPhotoForm({ id, hasPhoto, name, edit }: { id: string; hasPhoto: boolean; name: string; edit: { description: string; pointsCost: number; cashCents: number } }) {
  const [state, action, pending] = useActionState(setRewardImage, {});
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileId = useId();

  function send(fields: Record<string, string>) {
    const fd = new FormData();
    fd.set('id', id);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(() => action(fd));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
      send({ imageData: await shrinkImage(file, 640) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler a imagem.');
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;
  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-2">
        <label htmlFor={fileId} className={`action-tile ${working ? 'pointer-events-none opacity-60' : ''}`}>
          <Icon name="camera" size={18} /> {working ? 'Salvando…' : hasPhoto ? 'Trocar foto' : 'Pôr foto'}
        </label>
        <input id={fileId} type="file" accept="image/*" className="sr-only" onChange={onFile} disabled={working} />
        <button type="button" className="action-tile" onClick={() => setSearching((v) => !v)} aria-expanded={searching} disabled={working}>
          <Icon name="search" size={18} /> Buscar foto
        </button>
        <button type="button" className="action-tile" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          <Icon name="cog" size={18} /> Editar
        </button>
      </div>
      {editing && <EditRewardForm id={id} name={name} {...edit} onDone={() => setEditing(false)} />}
      {(error || state.error) && <p role="alert" className="mt-2 text-xs text-red-600">{error || state.error}</p>}
      {state.ok && !working && !error && <p role="status" className="mt-2 text-xs text-emerald-700">{state.ok}</p>}
      {searching && (
        <WebImageSearch
          initialQuery={name}
          onChoose={(item) => {
            setSearching(false);
            send({ imageWebUrl: item.image, imageWebAlt: item.alt ?? '' });
          }}
        />
      )}
    </div>
  );
}

/** Edita nome, pontos, valor em R$ (opcional) e descrição de um produto já cadastrado. */
function EditRewardForm({ id, name, description, pointsCost, cashCents, onDone }: { id: string; name: string; description: string; pointsCost: number; cashCents: number; onDone: () => void }) {
  const [state, action] = useActionState(updateReward, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  return (
    <form action={action} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_9rem]">
        <div>
          <label className="glass-label" htmlFor={`e-name-${id}`}>Nome</label>
          <input id={`e-name-${id}`} name="name" defaultValue={state.values?.name ?? name} className="glass-input" required maxLength={80} />
        </div>
        <div>
          <label className="glass-label" htmlFor={`e-pts-${id}`}>Pontos</label>
          <input id={`e-pts-${id}`} name="pointsCost" type="number" min={1} inputMode="numeric" defaultValue={state.values?.pointsCost ?? pointsCost} className="glass-input" required />
        </div>
        <div>
          <label className="glass-label" htmlFor={`e-cash-${id}`}>Valor em R$ <span className="font-normal text-slate-500">(opcional)</span></label>
          <input id={`e-cash-${id}`} name="cashValue" inputMode="decimal" defaultValue={state.values?.cashValue ?? (cashCents > 0 ? (cashCents / 100).toFixed(2).replace('.', ',') : '')} className="glass-input" placeholder="0,00" />
        </div>
      </div>
      <div>
        <label className="glass-label" htmlFor={`e-desc-${id}`}>Descrição</label>
        <input id={`e-desc-${id}`} name="description" defaultValue={state.values?.description ?? description} className="glass-input" maxLength={160} placeholder="Opcional" />
      </div>
      <p className="text-xs text-slate-500">Resgates já feitos mantêm o preço da época. Com valor em R$, o cliente paga no balcão e dá os pontos.</p>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Salvando…" className="btn-sm">Salvar alterações</SubmitButton>
        <button type="button" className="glass-button-ghost btn-sm" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}

/** Abre o portal do Stripe (cartão, faturas, cancelamento); se falhar, explica e oferece o suporte. */
export function BillingPortalForm({ support }: { support: SupportContact | null }) {
  const [state, action] = useActionState(openBillingPortal, {});
  return (
    <form action={action} className="mt-6 border-t border-[#E5E7EB] pt-5">
      <h3 className="mb-1 font-semibold text-primary">Assinatura e faturas</h3>
      <p className="mb-3 text-sm text-slate-600">Troque o cartão, baixe as faturas e recibos ou cancele a assinatura, em uma página segura do Stripe.</p>
      <SubmitButton variant="ghost" pendingText="Abrindo…" className="btn-sm">Gerenciar assinatura e faturas</SubmitButton>
      {state.error && (
        <p role="alert" className="glass-error mt-3">
          {state.error} <SupportLinks support={support} />
        </p>
      )}
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

type Identity = {
  category: string;
  categoryOther: string;
  instagram: string;
  listed: boolean;
  logoUrl: string | null;
  coverUrl: string | null;
};

/** Logo, capa, categoria e Instagram da marca. Endereço, horário, localização e link do Google ficam em cada unidade. */
export function IdentityForm({ defaults, placeName, supportEnv }: { defaults: Identity; placeName: string; supportEnv: { email?: string | null; whatsapp?: string | null } }) {
  const [state, action] = useActionState(saveIdentity, {});
  // Controlado: um <select> não-controlado ficaria em branco depois que o formulário é reiniciado ao salvar.
  const [category, setCategory] = useState(state.values?.category ?? defaults.category);
  const [other, setOther] = useState(state.values?.categoryOther ?? defaults.categoryOther);
  const [listed, setListed] = useState(state.values ? state.values.listed === 'on' : defaults.listed);
  const help = buildSupport(supportEnv, 'Categoria no Fidelize', categoryRequestMessage(placeName, category === 'outros' ? other : ''));
  const catRef = useRef<HTMLSelectElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);
  const [catStatus, setCatStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string }>({ kind: 'idle' });
  // O React 19 reinicia o formulário depois de salvar e isso apagava a opção escolhida na tela (embora estivesse salva):
  // depois de cada resposta do servidor, devolve aos campos o que o dono escolheu.
  useEffect(() => {
    if (catRef.current) catRef.current.value = category;
    if (otherRef.current) otherRef.current.value = other;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /** Categoria salva na hora, com aviso ao lado do campo (o botão "Salvar identidade" continua valendo para o resto). */
  function persistCategory(cat: string, otherText: string) {
    setCatStatus({ kind: 'saving' });
    startTransition(async () => {
      try {
        const r = await saveCategory(cat, otherText);
        setCatStatus(r.error ? { kind: 'error', msg: r.error } : { kind: 'saved' });
      } catch {
        setCatStatus({ kind: 'error', msg: 'Não foi possível salvar. Tente de novo.' });
      }
    });
  }
  const catNote = (
    <p role="status" aria-live="polite" className={`mt-1 min-h-[1.25rem] text-xs font-semibold ${catStatus.kind === 'error' ? 'text-rose-600' : catStatus.kind === 'saved' ? 'text-emerald-600' : 'text-slate-500'}`}>
      {catStatus.kind === 'saving' && 'Salvando…'}
      {catStatus.kind === 'saved' && '✓ Categoria salva'}
      {catStatus.kind === 'error' && catStatus.msg}
    </p>
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <ImageUpload name="logoData" label="Logo do restaurante" currentUrl={defaults.logoUrl} maxSide={320} hint="Quadrada, fundo claro funciona melhor." />
        <ImageUpload name="coverData" label="Foto de capa" currentUrl={defaults.coverUrl} maxSide={1100} shape="wide" hint="A foto que o cliente vê no topo da sua página." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="i-cat">Categoria</label>
          <select
            id="i-cat"
            ref={catRef}
            name="category"
            className="glass-input"
            value={category}
            onChange={(e) => {
              const v = e.target.value;
              setCategory(v);
              persistCategory(v, v === 'outros' ? other : '');
            }}
          >
            <option value="">Selecione…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{CATEGORY_HINT[c.value] && c.value !== 'outros' ? `${c.label} (${CATEGORY_HINT[c.value]})` : c.label}</option>
            ))}
          </select>
          {category !== 'outros' && catNote}
          {suggestsBooking(category) && (
            <p className="mt-2 rounded-lg border border-[#C3D2F4] bg-[#EEF3FD] p-3 text-xs text-slate-700">
              Esse tipo de negócio costuma atender com <strong>hora marcada</strong>. A aba <strong>Agenda</strong> já está liberada no menu: cadastre seus serviços para o cliente agendar pelo app.{' '}
              <Link href="/dashboard/configuracoes?etapa=agenda&abrir=agenda-conteudo#agenda" className="link-inline">Configurar a agenda</Link>
            </p>
          )}
        </div>
        <div>
          <label className="glass-label" htmlFor="i-ig">Instagram</label>
          <input id="i-ig" name="instagram" className="glass-input" placeholder="@seurestaurante" defaultValue={state.values?.instagram ?? defaults.instagram} autoCapitalize="none" />
        </div>
      </div>

      {category === 'outros' && (
        <div>
          <label className="glass-label" htmlFor="i-other">Qual é o seu tipo de negócio?</label>
          <input id="i-other" ref={otherRef} name="categoryOther" value={other} onChange={(e) => setOther(e.target.value)} onBlur={() => persistCategory('outros', other)} className="glass-input" placeholder="Ex.: doceria, ateliê, chaveiro" maxLength={60} />
          {catNote}
          <p className="mt-1 text-xs text-slate-500">Os clientes encontram você por esse texto em Lugares → Outros. Se quiser uma categoria própria, peça ao suporte.</p>
        </div>
      )}
      <p className="text-sm text-slate-600">
        Não achou a sua categoria, ou precisa trocar o nicho?{' '}
        {help.emailHref || help.whatsappHref ? (
          <SupportLinks support={help} lead="Fale com o suporte:" />
        ) : (
          <span className="text-slate-500">Escolha “Outros” e descreva o que você é.</span>
        )}
      </p>

      <div className="grid items-center gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="listed" checked={listed} onChange={(e) => setListed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 rounded accent-electric-500" />
          <span className="text-sm text-slate-700">
            <span className="font-semibold">Aparecer em “Lugares” no app dos clientes</span>
            <span className="block text-xs text-slate-500">Ligado por padrão: quem usa o Fidelize encontra seu estabelecimento, vê os prêmios e as ações que dão pontos.</span>
          </span>
        </label>
        <div>
          <SubmitButton pendingText="Salvando…" className="btn-sm">Salvar identidade</SubmitButton>
        </div>
      </div>
      {!listed && (
        <p role="alert" data-testid="listed-off-warning" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Atenção:</b> com isso desligado, seu estabelecimento deixa de aparecer em “Lugares” e quem ainda não é seu cliente não encontra você por lá. Salve para confirmar.
        </p>
      )}

      <FormMessage state={state} />
    </form>
  );
}

/**
 * Distância máxima do check-in: um controle deslizante sobre uma escala (10, 20, 30, 50, 75, 100… até 500 m), em vez de uma lista.
 * O servidor guarda os metros (`checkInRadiusM`); o `#e-rad` guarda a posição na escala.
 */
function RadiusSlider({ initial }: { initial: number }) {
  const last = CHECKIN_RADIUS_OPTIONS.length - 1;
  const [idx, setIdx] = useState(radiusIndex(initial));
  const cur = CHECKIN_RADIUS_OPTIONS[idx];
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label className="glass-label !mb-0" htmlFor="e-rad">Distância máxima do check-in</label>
        <output htmlFor="e-rad" className="text-2xl font-extrabold tabular-nums text-primary" data-testid="radius-value">{cur.label}</output>
      </div>
      <input type="hidden" name="checkInRadiusM" value={cur.value} />
      <input
        id="e-rad"
        type="range"
        min={0}
        max={last}
        step={1}
        value={idx}
        onChange={(e) => setIdx(Number(e.target.value))}
        aria-valuetext={cur.label}
        autoComplete="off"
        className="mt-3 h-2 w-full cursor-pointer accent-electric-500"
      />
      <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-500" aria-hidden>
        {[0, 3, 5, 7, last].map((i) => <span key={i}>{CHECKIN_RADIUS_OPTIONS[i].label}</span>)}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-700" data-testid="radius-hint">{cur.hint}</p>
      <p className="mt-1 text-xs text-slate-500">Distância entre o cliente e o ponto da sua unidade no mapa. O cliente não vê esse número nem quanto falta. Quanto maior o raio, mais o check-in aceita uma leitura de GPS imprecisa (como a de um computador, sem GPS). Se os clientes reclamarem que o check-in não funciona (loja grande, shopping, sinal fraco), aumente; confira também se o ponto da unidade está exato.</p>
    </div>
  );
}

type Toggle = { on: boolean; pts: string };

/** Um item do bloco "Check-in, indicação e aniversário": nome, pontos e a chave que liga/desliga (desligado = 0 pontos). */
function EngagementCell({ id, name, label, hint, t, setT, fallback }: { id: string; name: string; label: string; hint: string; t: Toggle; setT: (t: Toggle) => void; fallback: string }) {
  const value = t.on ? String(Number(t.pts) > 0 ? Number(t.pts) : 0) : '0';
  return (
    <div>
      <label className="glass-label" htmlFor={id}>{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          min={1}
          inputMode="numeric"
          className="glass-input min-w-0 flex-1 disabled:bg-slate-100 disabled:text-slate-400"
          value={t.on ? t.pts : ''}
          placeholder={t.on ? '' : 'Desligado'}
          disabled={!t.on}
          required={t.on}
          onChange={(e) => setT({ ...t, pts: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          aria-describedby={`${id}-hint`}
        />
        <Switch on={t.on} label={`${t.on ? 'Desligar' : 'Ligar'} ${label.toLowerCase()}`} onChange={(on) => setT({ on, pts: on && !(Number(t.pts) > 0) ? fallback : t.pts })} />
      </div>
      <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function EngagementForm({ defaults }: { defaults: { checkInPoints: number; checkInRadiusM: number; referralPoints: number; birthdayPoints: number } }) {
  const [state, action] = useActionState(saveEngagement, {});
  const start = (k: 'checkInPoints' | 'referralPoints' | 'birthdayPoints'): Toggle => {
    const n = Number(state.values?.[k] ?? defaults[k]);
    return { on: n > 0, pts: n > 0 ? String(n) : '' };
  };
  const [ci, setCi] = useState<Toggle>(() => start('checkInPoints'));
  const [rf, setRf] = useState<Toggle>(() => start('referralPoints'));
  const [bd, setBd] = useState<Toggle>(() => start('birthdayPoints'));
  const radius = Number(state.values?.checkInRadiusM ?? defaults.checkInRadiusM);
  return (
    <form action={action} className="space-y-4">
      <div className="grid items-start gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <EngagementCell id="e-ci" name="checkInPoints" label="Pontos por check-in" hint="1 por dia, pelo GPS." t={ci} setT={setCi} fallback="10" />
        <EngagementCell id="e-rf" name="referralPoints" label="Pontos por indicação" hint="Quando o amigo faz a 1ª compra." t={rf} setT={setRf} fallback="50" />
        <EngagementCell id="e-bd" name="birthdayPoints" label="Presente de aniversário" hint="No dia, uma vez por ano." t={bd} setT={setBd} fallback="50" />
        <div className="sm:pt-[1.65rem]">
          <SubmitButton pendingText="Salvando…" className="btn-sm">Salvar</SubmitButton>
        </div>
      </div>
      <p className="text-xs text-slate-500">Cada item tem a sua chave: desligado, o cliente não vê nem ganha esses pontos. Quem informou o aniversário e tem carteira aqui ganha o presente.</p>
      {ci.on ? <RadiusSlider initial={radius} /> : <input type="hidden" name="checkInRadiusM" value={radius} />}
      <FormMessage state={state} />
    </form>
  );
}

export function SharingForm({ defaults }: { defaults: { pointsShareOut: boolean; pointsAcceptIn: boolean } }) {
  const [state, action] = useActionState(saveSharing, {});
  const option = 'flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 has-[:checked]:border-electric-500 has-[:checked]:bg-[#F3F6FD]';
  return (
    <form action={action} className="space-y-3">
      <label className={option}>
        <input type="checkbox" name="pointsShareOut" defaultChecked={defaults.pointsShareOut} className="mt-0.5 h-5 w-5 shrink-0 rounded accent-electric-500" />
        <span className="min-w-0">
          <span className="block font-semibold text-slate-800">Meus pontos valem em outros lugares</span>
          <span className="mt-0.5 block text-sm text-slate-500">Seus clientes usam os pontos ganhos aqui nos lugares que aceitam pontos de outros.</span>
        </span>
      </label>
      <label className={option}>
        <input type="checkbox" name="pointsAcceptIn" defaultChecked={defaults.pointsAcceptIn} className="mt-0.5 h-5 w-5 shrink-0 rounded accent-electric-500" />
        <span className="min-w-0">
          <span className="block font-semibold text-slate-800">Aceito pontos de outros lugares</span>
          <span className="mt-0.5 block text-sm text-slate-500">Clientes de outros lugares usam aqui os pontos que ganharam lá. Seu nome aparece na lista de quem aceita.</span>
        </span>
      </label>
      <details className="group rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-slate-700">
          <Icon name="info" size={16} className="shrink-0 text-electric-600" />
          <span className="flex-1">Como funciona</span>
          <Icon name="down" size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Os dois começam desligados e você muda quando quiser.</li>
          <li>Se o cliente não tem pontos suficientes num lugar que aceita pontos de outros, ele completa com pontos de lugares que compartilham.</li>
          <li>A troca é pelo valor: quem dá 10 pontos por real e quem dá 5 têm pontos de valores diferentes, e a conversão respeita isso.</li>
          <li>O Fidelize não faz acerto de dinheiro entre os lugares: quem entrega o prêmio arca com ele.</li>
        </ul>
      </details>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
    </form>
  );
}

export type UnitFormData = {
  id: string | null;
  name: string;
  address: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  googleReviewUrl: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  schedule: unknown;
};

/** Cadastro de uma unidade: nome, endereço, horários por dia, localização (GPS) e link de avaliação do Google. */
export function UnitForm({ unit, uid }: { unit: UnitFormData; uid: string }) {
  const [state, action] = useActionState(saveUnit, {});
  const [days, setDays] = useState<Schedule>(() => parseSchedule(unit.schedule) ?? defaultSchedule());
  const [coords, setCoords] = useState<{ lat: string; lng: string }>({
    lat: state.values?.latitude ?? (unit.latitude != null ? String(unit.latitude) : ''),
    lng: state.values?.longitude ?? (unit.longitude != null ? String(unit.longitude) : ''),
  });
  const isNew = unit.id === null;
  const [activeOn, setActiveOn] = useState(state.values ? state.values.active === 'on' : unit.active);

  // Endereço: o CEP preenche rua, bairro, cidade e UF; número e complemento o dono completa.
  const v = state.values;
  const [addr, setAddr] = useState({
    cep: maskCep(v?.cep ?? unit.cep),
    street: v?.street ?? unit.street,
    number: v?.number ?? unit.number,
    complement: v?.complement ?? unit.complement,
    district: v?.district ?? unit.district,
    city: v?.city ?? unit.city,
    state: v?.state ?? unit.state,
  });
  const setField = (k: keyof typeof addr) => (e: { target: { value: string } }) => setAddr((a) => ({ ...a, [k]: e.target.value }));
  const [cepStatus, setCepStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'error'; msg?: string }>({ kind: 'idle' });

  async function lookupCep(raw: string) {
    const digits = cepDigits(raw);
    if (digits.length !== 8) return;
    setCepStatus({ kind: 'loading' });
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const found = parseViaCep(await res.json());
      if (!found) {
        setCepStatus({ kind: 'error', msg: 'CEP não encontrado. Confira os números ou preencha o endereço abaixo.' });
        return;
      }
      setAddr((a) => ({ ...a, street: found.street || a.street, district: found.district || a.district, city: found.city || a.city, state: found.state || a.state }));
      setCepStatus({ kind: 'ok', msg: 'Endereço preenchido pelo CEP. Agora informe o número e o complemento.' });
    } catch {
      setCepStatus({ kind: 'error', msg: 'Não foi possível consultar o CEP agora. Preencha o endereço abaixo.' });
    }
  }

  return (
    <form action={action} className="space-y-5" key={isNew ? (state.ok ?? 'new') : undefined}>
      {unit.id && <input type="hidden" name="id" value={unit.id} />}
      <input type="hidden" name="schedule" value={JSON.stringify(days)} />
      <input type="hidden" name="latitude" value={coords.lat} />
      <input type="hidden" name="longitude" value={coords.lng} />

      <div>
        <label className="glass-label" htmlFor={`${uid}name`}>Nome da unidade</label>
        <input id={`${uid}name`} name="name" className="glass-input" placeholder="Ex.: Centro, Shopping Norte" defaultValue={state.values?.name ?? unit.name} required />
      </div>

      <fieldset className="space-y-4">
        <legend className="glass-label">Endereço</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="glass-label" htmlFor={`${uid}cep`}>CEP</label>
            <input
              id={`${uid}cep`}
              name="cep"
              className="glass-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="00000-000"
              value={addr.cep}
              onChange={(e) => {
                const masked = maskCep(e.target.value);
                setAddr((a) => ({ ...a, cep: masked }));
                if (cepDigits(masked).length === 8) void lookupCep(masked);
                else setCepStatus({ kind: 'idle' });
              }}
              maxLength={9}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="glass-label" htmlFor={`${uid}street`}>Rua / avenida</label>
            <input id={`${uid}street`} name="street" className="glass-input" placeholder="Rua, avenida, praça…" value={addr.street} onChange={setField('street')} required />
          </div>
        </div>
        {cepStatus.kind !== 'idle' && (
          <p role={cepStatus.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${cepStatus.kind === 'error' ? 'text-red-600' : cepStatus.kind === 'ok' ? 'text-emerald-700' : 'text-slate-500'}`}>
            {cepStatus.kind === 'loading' ? 'Buscando o CEP…' : cepStatus.msg}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="glass-label" htmlFor={`${uid}number`}>Número</label>
            <input id={`${uid}number`} name="number" className="glass-input" placeholder="Ex.: 100 ou S/N" value={addr.number} onChange={setField('number')} required />
          </div>
          <div className="sm:col-span-2">
            <label className="glass-label" htmlFor={`${uid}complement`}>Complemento <span className="font-normal text-slate-400">(opcional)</span></label>
            <input id={`${uid}complement`} name="complement" className="glass-input" placeholder="Loja 12, 2º andar, bloco B…" value={addr.complement} onChange={setField('complement')} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="glass-label" htmlFor={`${uid}district`}>Bairro</label>
            <input id={`${uid}district`} name="district" className="glass-input" value={addr.district} onChange={setField('district')} />
          </div>
          <div className="sm:col-span-3">
            <label className="glass-label" htmlFor={`${uid}city`}>Cidade</label>
            <input id={`${uid}city`} name="city" className="glass-input" value={addr.city} onChange={setField('city')} required />
          </div>
          <div>
            <label className="glass-label" htmlFor={`${uid}state`}>UF</label>
            <select id={`${uid}state`} name="state" className="glass-input" value={addr.state} onChange={setField('state')} required>
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <div>
        <label className="glass-label" htmlFor={`${uid}google`}>Link para avaliar esta unidade no Google</label>
        <input id={`${uid}google`} name="googleReviewUrl" className="glass-input" placeholder="https://g.page/r/…/review" defaultValue={state.values?.googleReviewUrl ?? unit.googleReviewUrl} inputMode="url" autoCapitalize="none" />
        <p className="mt-1 text-xs text-slate-500">
          No Google Meu Negócio, abra o perfil da unidade e toque em “Pedir avaliações” para copiar o link. Também aceitamos o Place ID.
        </p>
      </div>

      <UnitLocationField coords={coords} setCoords={setCoords} addr={addr} />

      <div>
        <p className="glass-label">Horário de funcionamento</p>
        <HoursGrid days={days} setDays={setDays} idPrefix={uid} />
      </div>

      {!isNew && (
        <label className="flex items-center gap-3">
          <input type="checkbox" name="active" checked={activeOn} onChange={(e) => setActiveOn(e.target.checked)} className="h-5 w-5 rounded accent-electric-500" />
          <span className="text-sm text-slate-700"><span className="font-semibold">Unidade ativa</span> — aparece para os clientes e pode lançar pontos</span>
        </label>
      )}

      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">{isNew ? 'Adicionar unidade' : 'Salvar unidade'}</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, {});
  return (
    <form action={action} className="max-w-md space-y-4">
      <input type="text" name="username" autoComplete="username" className="sr-only" tabIndex={-1} aria-hidden defaultValue="" />
      <div>
        <label className="glass-label" htmlFor="pw-cur">Senha atual</label>
        <input id="pw-cur" name="current" type="password" autoComplete="current-password" className="glass-input" required />
      </div>
      <div>
        <label className="glass-label" htmlFor="pw-new">Nova senha</label>
        <input id="pw-new" name="next" type="password" autoComplete="new-password" minLength={8} maxLength={72} className="glass-input" required />
        <p className="mt-1 text-xs text-slate-500">Mínimo de 8 caracteres.</p>
      </div>
      <div>
        <label className="glass-label" htmlFor="pw-conf">Repita a nova senha</label>
        <input id="pw-conf" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} className="glass-input" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Trocar senha</SubmitButton>
    </form>
  );
}
