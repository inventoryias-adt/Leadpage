'use client';

import Link from 'next/link';
import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import {
  addChallenge,
  addInteraction,
  addPromotion,
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
import { CHECKIN_RADIUS_OPTIONS } from '@/lib/geo';
import { ImageUpload, shrinkImage } from './ImageUpload';
import { WebImageSearch } from './WebImageSearch';
import { FormMessage, SubmitButton } from './ui';

type Basics = { name: string };

export function BasicsForm({ defaults }: { defaults: Basics }) {
  const [state, action] = useActionState(saveBasics, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="glass-label" htmlFor="b-name">Nome do estabelecimento</label>
        <input id="b-name" name="name" className="glass-input" defaultValue={state.values?.name ?? defaults.name} required />
        <p className="mt-1 text-xs text-slate-500">É o nome que o cliente vê. Endereço e horário ficam em cada unidade.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar nome</SubmitButton>
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
      <ImageUpload name="imageData" label="Foto do produto" hint="Opcional, mas aumenta muito a vontade de resgatar." maxSide={640} webSearch />
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
              <Link href="/dashboard/configuracoes?abrir=agenda#agenda" className="link-inline">Configurar a agenda</Link>
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

      <label className="flex items-start gap-3">
        <input type="checkbox" name="listed" defaultChecked={state.values ? state.values.listed === 'on' : defaults.listed} className="mt-1 h-5 w-5 rounded accent-electric-500" />
        <span className="text-sm text-slate-700">
          <span className="font-semibold">Aparecer em “Lugares” no app dos clientes</span>
          <span className="block text-xs text-slate-500">Quem usa o Fidelize pode encontrar seu restaurante, ver os prêmios e as ações que dão pontos.</span>
        </span>
      </label>

      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar identidade</SubmitButton>
    </form>
  );
}

export function EngagementForm({ defaults }: { defaults: { checkInPoints: number; checkInRadiusM: number; referralPoints: number; birthdayPoints: number } }) {
  const [state, action] = useActionState(saveEngagement, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="e-ci">Pontos por check-in (1 por dia)</label>
          <input id="e-ci" name="checkInPoints" type="number" min={0} inputMode="numeric" className="glass-input" defaultValue={state.values?.checkInPoints ?? defaults.checkInPoints} required />
          <p className="mt-1 text-xs text-slate-500">O cliente confirma que está no local pelo GPS. Use 0 para desligar.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor="e-rad">Distância máxima do check-in</label>
          <select id="e-rad" name="checkInRadiusM" className="glass-input" defaultValue={state.values?.checkInRadiusM ?? String(defaults.checkInRadiusM)}>
            {CHECKIN_RADIUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">Distância entre o cliente e o ponto da sua unidade no mapa. O cliente não vê esse número nem quanto falta. Para valer só dentro da loja, use 10 m e confira se o ponto da unidade está exato; se os clientes reclamarem que o check-in não funciona (loja grande, shopping, sinal fraco), aumente.</p>
        </div>
        <div>
          <label className="glass-label" htmlFor="e-rf">Pontos por indicação</label>
          <input id="e-rf" name="referralPoints" type="number" min={0} inputMode="numeric" className="glass-input" defaultValue={state.values?.referralPoints ?? defaults.referralPoints} required />
          <p className="mt-1 text-xs text-slate-500">Quem indica ganha quando o amigo faz a primeira compra. Use 0 para desligar.</p>
        </div>
        <div>
          <label className="glass-label" htmlFor="e-bd">Presente de aniversário (pontos)</label>
          <input id="e-bd" name="birthdayPoints" type="number" min={0} inputMode="numeric" className="glass-input" defaultValue={state.values?.birthdayPoints ?? defaults.birthdayPoints} required />
          <p className="mt-1 text-xs text-slate-500">Quem tem carteira aqui e informou o aniversário ganha estes pontos no dia, uma vez por ano. Use 0 para desligar.</p>
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
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

export function AddChallengeForm() {
  const [state, action] = useActionState(addChallenge, {});
  const [kind, setKind] = useState<'PURCHASES' | 'CHECKINS'>((state.values?.kind as 'PURCHASES' | 'CHECKINS') ?? 'PURCHASES');
  return (
    <form action={action} className="space-y-3" key={state.ok ?? 'idle'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="c-kind">O cliente precisa…</label>
          <select id="c-kind" name="kind" className="glass-input" value={kind} onChange={(e) => setKind(e.target.value as 'PURCHASES' | 'CHECKINS')}>
            <option value="PURCHASES">Fazer compras</option>
            <option value="CHECKINS">Fazer check-ins</option>
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor="c-period">Período</label>
          <select id="c-period" name="period" className="glass-input" defaultValue={state.values?.period ?? 'WEEK'}>
            <option value="WEEK">Por semana (seg a dom)</option>
            <option value="MONTH">Por mês</option>
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor="c-target">Quantas vezes</label>
          <input id="c-target" name="target" type="number" min={1} max={60} inputMode="numeric" className="glass-input" defaultValue={state.values?.target ?? 2} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="c-bonus">Bônus (pontos)</label>
          <input id="c-bonus" name="bonusPoints" type="number" min={1} inputMode="numeric" className="glass-input" defaultValue={state.values?.bonusPoints} placeholder="Ex.: 200" required />
        </div>
      </div>
      {kind === 'PURCHASES' && (
        <div>
          <label className="glass-label" htmlFor="c-min">Valor mínimo de cada compra (R$) <span className="font-normal text-slate-500">— opcional</span></label>
          <input id="c-min" name="minAmount" inputMode="decimal" className="glass-input" defaultValue={state.values?.minAmount} placeholder="Ex.: 42,00" />
        </div>
      )}
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Criando…">Criar desafio</SubmitButton>
    </form>
  );
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Nova campanha de pontos: multiplicador ou pontos extras, com período, dias da semana e horário opcionais. */
export function AddPromotionForm() {
  const [state, action] = useActionState(addPromotion, {});
  const [kind, setKind] = useState<'MULTIPLIER' | 'BONUS'>((state.values?.kind as 'MULTIPLIER' | 'BONUS') ?? 'MULTIPLIER');
  const [audience, setAudience] = useState<'ALL' | 'NEW' | 'INACTIVE'>((state.values?.audience as 'ALL' | 'NEW' | 'INACTIVE') ?? 'ALL');
  return (
    <form action={action} className="space-y-4" key={state.ok ?? 'idle'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor="p-title">Nome da campanha</label>
          <input id="p-title" name="title" className="glass-input" placeholder="Ex.: Terça em dobro" defaultValue={state.values?.title} maxLength={60} required />
        </div>
        <div>
          <label className="glass-label" htmlFor="p-kind">Tipo</label>
          <select id="p-kind" name="kind" className="glass-input" value={kind} onChange={(e) => setKind(e.target.value as 'MULTIPLIER' | 'BONUS')}>
            <option value="MULTIPLIER">Multiplicar os pontos da compra</option>
            <option value="BONUS">Dar pontos extras na compra</option>
          </select>
        </div>
        {kind === 'MULTIPLIER' ? (
          <div>
            <label className="glass-label" htmlFor="p-mult">Multiplicador</label>
            <select id="p-mult" name="multiplier" className="glass-input" defaultValue={state.values?.multiplier ?? '2'}>
              <option value="1.5">1,5x</option>
              <option value="2">2x (pontos em dobro)</option>
              <option value="3">3x (pontos em triplo)</option>
              <option value="4">4x</option>
              <option value="5">5x</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="glass-label" htmlFor="p-bonus">Pontos extras por compra</label>
            <input id="p-bonus" name="bonusPoints" type="number" min={1} inputMode="numeric" className="glass-input" placeholder="Ex.: 50" defaultValue={state.values?.bonusPoints} required />
          </div>
        )}
        <div>
          <label className="glass-label" htmlFor="p-audience">Para quem</label>
          <select id="p-audience" name="audience" className="glass-input" value={audience} onChange={(e) => setAudience(e.target.value as 'ALL' | 'NEW' | 'INACTIVE')}>
            <option value="ALL">Todos os clientes</option>
            <option value="NEW">Só na primeira compra (clientes novos)</option>
            <option value="INACTIVE">Quem não compra há um tempo</option>
          </select>
        </div>
        {audience === 'INACTIVE' ? (
          <div>
            <label className="glass-label" htmlFor="p-inactive">Sem comprar há (dias)</label>
            <input id="p-inactive" name="inactiveDays" type="number" min={7} max={365} inputMode="numeric" className="glass-input" defaultValue={state.values?.inactiveDays ?? 30} required />
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor="p-min">Valor mínimo da compra (R$) <span className="font-normal text-slate-500">— opcional</span></label>
          <input id="p-min" name="minAmount" inputMode="decimal" className="glass-input" placeholder="Ex.: 40,00" defaultValue={state.values?.minAmount} />
        </div>
      </div>

      <fieldset>
        <legend className="glass-label">Dias da semana <span className="font-normal text-slate-500">— nenhum marcado = todos os dias</span></legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((d, i) => (
            <label key={d} className="inline-flex items-center gap-2 rounded-md border border-[#D5DAE3] bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 has-[:checked]:border-electric-500 has-[:checked]:bg-electric-500 has-[:checked]:text-white">
              <input type="checkbox" name="weekdays" value={i} className="sr-only" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="p-start-time">Horário inicial <span className="font-normal text-slate-500">— opcional</span></label>
          <input id="p-start-time" name="startTime" type="time" className="glass-input" defaultValue={state.values?.startTime} />
        </div>
        <div>
          <label className="glass-label" htmlFor="p-end-time">Horário final <span className="font-normal text-slate-500">— opcional</span></label>
          <input id="p-end-time" name="endTime" type="time" className="glass-input" defaultValue={state.values?.endTime} />
        </div>
        <div>
          <label className="glass-label" htmlFor="p-start-date">Começa em <span className="font-normal text-slate-500">— opcional</span></label>
          <input id="p-start-date" name="startDate" type="date" className="glass-input" defaultValue={state.values?.startDate} />
        </div>
        <div>
          <label className="glass-label" htmlFor="p-end-date">Termina em <span className="font-normal text-slate-500">— opcional</span></label>
          <input id="p-end-date" name="endDate" type="date" className="glass-input" defaultValue={state.values?.endDate} />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        A campanha vale no caixa, no horário de Brasília, e já aparece como card na vitrine “Lugares”. Multiplicadores não se somam (vale o maior); pontos extras se somam. Campanhas para um público específico (clientes novos ou quem sumiu) entram quando o cliente lê o QR Code, porque só então sabemos quem ele é.
      </p>
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Criando…">Criar campanha</SubmitButton>
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
          <input type="checkbox" name="active" defaultChecked={state.values ? state.values.active === 'on' : unit.active} className="h-5 w-5 rounded accent-electric-500" />
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
