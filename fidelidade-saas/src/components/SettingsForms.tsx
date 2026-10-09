'use client';

import { startTransition, useActionState, useEffect, useId, useState } from 'react';
import {
  addChallenge,
  addInteraction,
  addPromotion,
  addReward,
  finishOnboarding,
  saveBasics,
  saveEngagement,
  saveIdentity,
  saveRules,
  saveUnit,
  setRewardImage,
  updateReward,
} from '@/app/actions/restaurant';
import { changePassword, openBillingPortal } from '@/app/actions/auth';
import { UFS, cepDigits, maskCep, parseViaCep } from '@/lib/address';
import { CATEGORIES, CATEGORY_HINT } from '@/lib/categories';
import { categoryRequestMessage, supportLink } from '@/lib/support';
import { defaultSchedule, parseSchedule, type Schedule } from '@/lib/hours';
import { HoursGrid } from './HoursGrid';
import { Icon } from './Icons';
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
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={fileId} className={`glass-button-ghost btn-sm ${working ? 'pointer-events-none opacity-60' : ''}`}>
          <Icon name="camera" size={15} /> {working ? 'Salvando…' : hasPhoto ? 'Trocar foto' : 'Adicionar foto'}
        </label>
        <input id={fileId} type="file" accept="image/*" className="sr-only" onChange={onFile} disabled={working} />
        <button type="button" className="glass-button-ghost btn-sm" onClick={() => setSearching((v) => !v)} aria-expanded={searching} disabled={working}>
          <Icon name="search" size={15} /> Buscar na web
        </button>
        <button type="button" className="glass-button-ghost btn-sm" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          <Icon name="cog" size={15} /> Editar produto
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
export function BillingPortalForm({ supportHref }: { supportHref: string | null }) {
  const [state, action] = useActionState(openBillingPortal, {});
  return (
    <form action={action} className="mt-6 border-t border-[#E5E7EB] pt-5">
      <h3 className="mb-1 font-semibold text-primary">Assinatura e faturas</h3>
      <p className="mb-3 text-sm text-slate-600">Troque o cartão, baixe as faturas e recibos ou cancele a assinatura, em uma página segura do Stripe.</p>
      <SubmitButton variant="ghost" pendingText="Abrindo…" className="btn-sm">Gerenciar assinatura e faturas</SubmitButton>
      {state.error && (
        <p role="alert" className="glass-error mt-3">
          {state.error}{' '}
          {supportHref && <a href={supportHref} target="_blank" rel="noopener noreferrer" className="link-inline">Falar com o suporte</a>}
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
export function IdentityForm({ defaults, placeName, supportWhatsapp }: { defaults: Identity; placeName: string; supportWhatsapp?: string }) {
  const [state, action] = useActionState(saveIdentity, {});
  // Controlado: um <select> não-controlado ficaria em branco depois que o formulário é reiniciado ao salvar.
  const [category, setCategory] = useState(state.values?.category ?? defaults.category);
  const [other, setOther] = useState(state.values?.categoryOther ?? defaults.categoryOther);
  const help = supportLink(supportWhatsapp, categoryRequestMessage(placeName, category === 'outros' ? other : ''));

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <ImageUpload name="logoData" label="Logo do restaurante" currentUrl={defaults.logoUrl} maxSide={320} hint="Quadrada, fundo claro funciona melhor." />
        <ImageUpload name="coverData" label="Foto de capa" currentUrl={defaults.coverUrl} maxSide={1100} shape="wide" hint="A foto que o cliente vê no topo da sua página." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="i-cat">Categoria</label>
          <select id="i-cat" name="category" className="glass-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Selecione…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{CATEGORY_HINT[c.value] && c.value !== 'outros' ? `${c.label} (${CATEGORY_HINT[c.value]})` : c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor="i-ig">Instagram</label>
          <input id="i-ig" name="instagram" className="glass-input" placeholder="@seurestaurante" defaultValue={state.values?.instagram ?? defaults.instagram} autoCapitalize="none" />
        </div>
      </div>

      {category === 'outros' && (
        <div>
          <label className="glass-label" htmlFor="i-other">Qual é o seu tipo de negócio?</label>
          <input id="i-other" name="categoryOther" value={other} onChange={(e) => setOther(e.target.value)} className="glass-input" placeholder="Ex.: doceria, ateliê, chaveiro" maxLength={60} />
          <p className="mt-1 text-xs text-slate-500">Os clientes encontram você por esse texto em Lugares → Outros. Se quiser uma categoria própria, peça ao suporte.</p>
        </div>
      )}
      <p className="text-sm text-slate-600">
        Não achou a sua categoria, ou precisa trocar o nicho?{' '}
        {help ? (
          <a href={help} target="_blank" rel="noopener noreferrer" className="link-inline">Fale com o suporte no WhatsApp</a>
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

export function EngagementForm({ defaults }: { defaults: { checkInPoints: number; referralPoints: number } }) {
  const [state, action] = useActionState(saveEngagement, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor="e-ci">Pontos por check-in (1 por dia)</label>
          <input id="e-ci" name="checkInPoints" type="number" min={0} inputMode="numeric" className="glass-input" defaultValue={state.values?.checkInPoints ?? defaults.checkInPoints} required />
          <p className="mt-1 text-xs text-slate-500">O cliente confirma que está no local pelo GPS. Use 0 para desligar.</p>
        </div>
        <div>
          <label className="glass-label" htmlFor="e-rf">Pontos por indicação</label>
          <input id="e-rf" name="referralPoints" type="number" min={0} inputMode="numeric" className="glass-input" defaultValue={state.values?.referralPoints ?? defaults.referralPoints} required />
          <p className="mt-1 text-xs text-slate-500">Quem indica ganha quando o amigo faz a primeira compra. Use 0 para desligar.</p>
        </div>
      </div>
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
  const [geo, setGeo] = useState<'idle' | 'loading' | 'error'>('idle');
  const [geoError, setGeoError] = useState('');
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
  const [locating, setLocating] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'error'; msg?: string }>({ kind: 'idle' });

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

  /** Acha as coordenadas pelo endereço (aproximado), para quem não está na unidade na hora de cadastrar. */
  async function locateByAddress() {
    setLocating({ kind: 'loading' });
    const base = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR';
    const attempts = [
      `${base}&street=${encodeURIComponent(`${addr.number} ${addr.street}`.trim())}&city=${encodeURIComponent(addr.city)}&state=${encodeURIComponent(addr.state)}`,
      `${base}&street=${encodeURIComponent(addr.street)}&city=${encodeURIComponent(addr.city)}&state=${encodeURIComponent(addr.state)}`,
      ...(cepDigits(addr.cep).length === 8 ? [`${base}&postalcode=${encodeURIComponent(maskCep(addr.cep))}`] : []),
    ];
    try {
      for (const url of attempts) {
        const hits = (await (await fetch(url)).json()) as { lat: string; lon: string }[];
        if (hits[0]) {
          setCoords({ lat: Number(hits[0].lat).toFixed(6), lng: Number(hits[0].lon).toFixed(6) });
          setLocating({ kind: 'ok', msg: 'Localização definida pelo endereço (aproximada). Confira no mapa; para mais precisão use o GPS dentro da unidade.' });
          return;
        }
      }
      setLocating({ kind: 'error', msg: 'Não encontramos esse endereço no mapa. Use o GPS dentro da unidade.' });
    } catch {
      setLocating({ kind: 'error', msg: 'Não foi possível consultar o mapa agora. Tente de novo ou use o GPS.' });
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setGeo('error');
      setGeoError('Seu navegador não permite obter a localização.');
      return;
    }
    setGeo('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setGeo('idle');
      },
      (err) => {
        setGeo('error');
        setGeoError(err.code === err.PERMISSION_DENIED ? 'Permissão negada. Libere a localização no navegador e tente de novo.' : 'Não foi possível obter a localização. Tente de novo.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
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

      <div className="glass-inset space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Icon name="pin" className="mt-0.5 text-electric-600" />
          <div>
            <p className="font-semibold text-slate-800">Localização da unidade</p>
            <p className="text-xs text-slate-500">
              Usada no check-in (o cliente precisa estar a até 200 m) e para a unidade aparecer em “Lugares perto de você”. Estando na unidade, use o GPS (mais preciso). Se não estiver, localize pelo endereço.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={useMyLocation} disabled={geo === 'loading'} className="glass-button-ghost btn-sm">
            {geo === 'loading' ? 'Obtendo localização…' : 'Usar minha localização atual'}
          </button>
          <button
            type="button"
            onClick={locateByAddress}
            disabled={locating.kind === 'loading' || !addr.street.trim() || !addr.city.trim() || !addr.state}
            className="glass-button-ghost btn-sm"
          >
            {locating.kind === 'loading' ? 'Procurando…' : 'Localizar pelo endereço'}
          </button>
          {coords.lat && coords.lng ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <Icon name="check" size={16} /> Localização definida ({Number(coords.lat).toFixed(4)}, {Number(coords.lng).toFixed(4)})
            </span>
          ) : (
            <span className="text-sm text-slate-500">Ainda não definida</span>
          )}
        </div>
        {geo === 'error' && <p role="alert" className="text-xs text-red-600">{geoError}</p>}
        {locating.kind !== 'idle' && locating.kind !== 'loading' && (
          <p role={locating.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${locating.kind === 'error' ? 'text-red-600' : 'text-slate-600'}`}>
            {locating.msg}
            {locating.kind === 'ok' && coords.lat && (
              <> <a className="link-inline" href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`} target="_blank" rel="noopener noreferrer">Ver no mapa</a></>
            )}
          </p>
        )}
      </div>

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
