'use client';

import { useActionState, useState } from 'react';
import {
  addChallenge,
  addInteraction,
  addReward,
  finishOnboarding,
  saveBasics,
  saveEngagement,
  saveIdentity,
  saveRules,
  saveUnit,
  setRewardImage,
} from '@/app/actions/restaurant';
import { CATEGORIES } from '@/lib/categories';
import { defaultSchedule, parseSchedule, type Schedule } from '@/lib/hours';
import { HoursGrid } from './HoursGrid';
import { Icon } from './Icons';
import { ImageUpload } from './ImageUpload';
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
      <ImageUpload name="imageData" label="Foto do produto" hint="Opcional, mas aumenta muito a vontade de resgatar." maxSide={640} />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <input name="name" defaultValue={state.values?.name} className="glass-input" placeholder="Ex.: Sobremesa grátis" aria-label="Nome do produto" required />
        <input name="pointsCost" defaultValue={state.values?.pointsCost} type="number" min={1} inputMode="numeric" className="glass-input" placeholder="Pontos" aria-label="Custo em pontos" required />
      </div>
      <input name="description" defaultValue={state.values?.description} className="glass-input" placeholder="Descrição curta (opcional)" aria-label="Descrição do produto" maxLength={160} />
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Adicionando…">Adicionar produto</SubmitButton>
    </form>
  );
}

/** Troca a foto de um prêmio já cadastrado. */
export function RewardPhotoForm({ id, currentUrl }: { id: string; currentUrl: string | null }) {
  const [state, action] = useActionState(setRewardImage, {});
  return (
    <form action={action} className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white/60 p-3">
      <input type="hidden" name="id" value={id} />
      <ImageUpload name="imageData" label="Foto" currentUrl={currentUrl} maxSide={640} />
      <FormMessage state={state} />
      <SubmitButton variant="ghost" pendingText="Salvando…" className="btn-sm">Salvar foto</SubmitButton>
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
  instagram: string;
  listed: boolean;
  logoUrl: string | null;
  coverUrl: string | null;
};

/** Logo, capa, categoria e Instagram da marca. Endereço, horário, localização e link do Google ficam em cada unidade. */
export function IdentityForm({ defaults }: { defaults: Identity }) {
  const [state, action] = useActionState(saveIdentity, {});
  // Controlado: um <select> não-controlado ficaria em branco depois que o formulário é reiniciado ao salvar.
  const [category, setCategory] = useState(state.values?.category ?? defaults.category);

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
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor="i-ig">Instagram</label>
          <input id="i-ig" name="instagram" className="glass-input" placeholder="@seurestaurante" defaultValue={state.values?.instagram ?? defaults.instagram} autoCapitalize="none" />
        </div>
      </div>

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

export type UnitFormData = {
  id: string | null;
  name: string;
  address: string;
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor={`${uid}name`}>Nome da unidade</label>
          <input id={`${uid}name`} name="name" className="glass-input" placeholder="Ex.: Centro, Shopping Norte" defaultValue={state.values?.name ?? unit.name} required />
        </div>
        <div>
          <label className="glass-label" htmlFor={`${uid}address`}>Endereço completo</label>
          <input id={`${uid}address`} name="address" className="glass-input" placeholder="Rua, número, bairro, cidade - UF" defaultValue={state.values?.address ?? unit.address} required />
        </div>
      </div>

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
              Usada no check-in (o cliente precisa estar a até 200 m) e para a unidade aparecer em “Lugares perto de você”. Toque no botão estando na unidade.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={useMyLocation} disabled={geo === 'loading'} className="glass-button-ghost btn-sm">
            {geo === 'loading' ? 'Obtendo localização…' : 'Usar minha localização atual'}
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
