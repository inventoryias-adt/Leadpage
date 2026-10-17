'use client';

import { useActionState, useEffect, useState } from 'react';
import { addChallenge, addPromotion, updateChallenge, updatePromotion } from '@/app/actions/restaurant';
import { describeChallenge } from '@/lib/challenges';
import { colorOf, promoDefaultColor, type ColorInfo } from '@/lib/palette';
import { formatPoints } from '@/lib/points';
import { CampaignTile } from './CampaignTile';
import { ColorSwatches } from './ColorSwatches';
import { Icon } from './Icons';
import { PreviewFrame } from './PreviewFrame';
import { ProgressBar } from './Visual';
import { FormMessage, SubmitButton } from './ui';

// ---------------------------------------------------------------- Desafios da casa

export type ChallengeInit = {
  id?: string;
  kind: 'PURCHASES' | 'CHECKINS';
  period: 'WEEK' | 'MONTH';
  target: string;
  bonus: string;
  min: string;
};

const EMPTY_CHALLENGE: ChallengeInit = { kind: 'PURCHASES', period: 'WEEK', target: '2', bonus: '', min: '' };

/** Como o desafio aparece para o cliente, na página do lugar (com a barra de progresso zerada). */
function ChallengePreview({ kind, period, target, bonus, min }: { kind: 'PURCHASES' | 'CHECKINS'; period: 'WEEK' | 'MONTH'; target: string; bonus: string; min: string }) {
  const goal = Math.max(1, parseInt(target, 10) || 1);
  const cents = Math.round((parseFloat(min.replace(',', '.')) || 0) * 100);
  const text = describeChallenge({ kind, period, target: goal, minAmountCents: kind === 'PURCHASES' ? cents : 0 });
  return (
    <PreviewFrame where="página do seu lugar, em “Desafios da casa”">
      <div data-testid="challenge-preview" className="glass-panel-sm space-y-2.5 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-start gap-3 font-semibold text-slate-800">
            <span className="icon-tile !bg-[#F1EAFE] !text-[#7C3AED]"><Icon name="trophy" /></span>
            <span className="pt-2">{text}</span>
          </span>
          <span className="chip-lima shrink-0">+{formatPoints(parseInt(bonus, 10) || 0)} pts</span>
        </div>
        <ProgressBar value={0} max={goal} label="Progresso do cliente" />
        <p className="text-xs font-semibold text-slate-500">0 de {goal} {period === 'WEEK' ? 'nesta semana' : 'neste mês'}</p>
      </div>
    </PreviewFrame>
  );
}

/** Criar ou editar um desafio (no modo editar, o `id` vai junto e o formulário fecha ao salvar). */
export function ChallengeForm({ init = EMPTY_CHALLENGE, onDone }: { init?: ChallengeInit; onDone?: () => void }) {
  const edit = !!init.id;
  const [state, action] = useActionState(edit ? updateChallenge : addChallenge, {});
  const v = state.values;
  const [kind, setKind] = useState<'PURCHASES' | 'CHECKINS'>((v?.kind as 'PURCHASES' | 'CHECKINS') ?? init.kind);
  const [draft, setDraft] = useState({ period: init.period, target: init.target, bonus: init.bonus, min: init.min });
  useEffect(() => {
    if (state.ok && edit) onDone?.();
    if (state.ok && !edit) setDraft({ period: 'WEEK', target: '2', bonus: '', min: '' });
  }, [state.ok]); // eslint-disable-line react-hooks/exhaustive-deps
  const sx = init.id ? `-${init.id}` : '';
  return (
    <form
      action={action}
      className="space-y-3"
      key={edit ? undefined : (state.ok ?? 'idle')}
      onChange={(e) => {
        const fd = new FormData(e.currentTarget);
        setDraft({ period: (fd.get('period') as 'WEEK' | 'MONTH') ?? 'WEEK', target: String(fd.get('target') ?? ''), bonus: String(fd.get('bonusPoints') ?? ''), min: String(fd.get('minAmount') ?? '') });
      }}
    >
      {init.id && <input type="hidden" name="id" value={init.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor={`c-kind${sx}`}>O cliente precisa…</label>
          <select id={`c-kind${sx}`} name="kind" className="glass-input" value={kind} onChange={(e) => setKind(e.target.value as 'PURCHASES' | 'CHECKINS')}>
            <option value="PURCHASES">Fazer compras</option>
            <option value="CHECKINS">Fazer check-ins</option>
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor={`c-period${sx}`}>Período</label>
          <select id={`c-period${sx}`} name="period" className="glass-input" defaultValue={v?.period ?? init.period}>
            <option value="WEEK">Por semana (seg a dom)</option>
            <option value="MONTH">Por mês</option>
          </select>
        </div>
        <div>
          <label className="glass-label" htmlFor={`c-target${sx}`}>Quantas vezes</label>
          <input id={`c-target${sx}`} name="target" type="number" min={1} max={60} inputMode="numeric" className="glass-input" defaultValue={v?.target ?? init.target} required />
        </div>
        <div>
          <label className="glass-label" htmlFor={`c-bonus${sx}`}>Bônus (pontos)</label>
          <input id={`c-bonus${sx}`} name="bonusPoints" type="number" min={1} inputMode="numeric" className="glass-input" defaultValue={v?.bonusPoints ?? init.bonus} placeholder="Ex.: 200" required />
        </div>
      </div>
      {kind === 'PURCHASES' && (
        <div>
          <label className="glass-label" htmlFor={`c-min${sx}`}>Valor mínimo de cada compra (R$) <span className="font-normal text-slate-500">— opcional</span></label>
          <input id={`c-min${sx}`} name="minAmount" inputMode="decimal" className="glass-input" defaultValue={v?.minAmount ?? init.min} placeholder="Ex.: 42,00" />
        </div>
      )}
      <ChallengePreview kind={kind} period={draft.period} target={draft.target} bonus={draft.bonus} min={kind === 'PURCHASES' ? draft.min : ''} />
      {edit && <p className="text-xs text-slate-500">A mudança vale daqui para frente; quem já concluiu o período atual não ganha de novo.</p>}
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant={edit ? 'primary' : 'ghost'} pendingText={edit ? 'Salvando…' : 'Criando…'} className={edit ? 'btn-sm' : ''}>{edit ? 'Salvar desafio' : 'Criar desafio'}</SubmitButton>
        {edit && <button type="button" className="glass-button-ghost btn-sm" onClick={onDone}>Cancelar</button>}
      </div>
    </form>
  );
}

export const AddChallengeForm = () => <ChallengeForm />;

/** Linha de um desafio: pontos, descrição, situação, e os botões Editar, Pausar/Retomar e Remover. */
export function ChallengeRow({ init, text, points, active, toggle, remove }: { init: ChallengeInit; text: string; points: number; active: boolean; toggle: React.ReactNode; remove: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3" data-testid="challenge-row">
      <div className="flex items-center gap-3">
        <span className="flex h-10 min-w-[3.5rem] shrink-0 items-center justify-center rounded-lg bg-[#E8EEFB] px-2 text-sm font-bold tabular-nums text-electric-600">+{formatPoints(points)}</span>
        <span className="min-w-0 flex-1 text-sm leading-snug text-slate-800">
          {text}
          <span className={`ml-2 rounded-md px-2 py-0.5 align-middle text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{active ? 'Ativo' : 'Pausado'}</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          aria-expanded={open}
          aria-label={`Editar desafio: ${text}`}
          title="Editar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
        >
          <Icon name="pencil" size={18} />
        </button>
        {toggle}
        {remove}
      </div>
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <ChallengeForm init={init} onDone={() => setOpen(false)} />
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- Campanhas de pontos

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MULTIPLIERS = ['1.5', '2', '3', '4', '5'];
const WHERE_PROMO = 'vitrine Lugares, página do seu lugar e cartão da carteira';

export type PromoInit = {
  id?: string;
  title: string;
  kind: 'MULTIPLIER' | 'BONUS';
  audience: 'ALL' | 'NEW' | 'INACTIVE';
  inactiveDays: string;
  multiplier: string;
  bonus: string;
  color: string;
  days: number[];
  start: string;
  end: string;
  min: string;
  startDate: string;
  endDate: string;
};

const EMPTY_PROMO: PromoInit = { title: '', kind: 'MULTIPLIER', audience: 'ALL', inactiveDays: '30', multiplier: '2', bonus: '', color: '', days: [], start: '', end: '', min: '', startDate: '', endDate: '' };

/** Criar ou editar uma campanha de pontos: multiplicador ou pontos extras, com período, dias da semana e horário opcionais. */
export function PromotionForm({ init = EMPTY_PROMO, onDone }: { init?: PromoInit; onDone?: () => void }) {
  const edit = !!init.id;
  const [state, action] = useActionState(edit ? updatePromotion : addPromotion, {});
  const v = state.values;
  const [kind, setKind] = useState<'MULTIPLIER' | 'BONUS'>((v?.kind as 'MULTIPLIER' | 'BONUS') ?? init.kind);
  const [audience, setAudience] = useState<'ALL' | 'NEW' | 'INACTIVE'>((v?.audience as 'ALL' | 'NEW' | 'INACTIVE') ?? init.audience);
  const fresh = { title: init.title, multiplier: init.multiplier, bonus: init.bonus, color: init.color, days: init.days, start: init.start, end: init.end, min: init.min };
  const [draft, setDraft] = useState(fresh);
  useEffect(() => {
    if (state.ok && edit) onDone?.();
    if (state.ok && !edit) setDraft({ title: '', multiplier: '2', bonus: '', color: '', days: [], start: '', end: '', min: '' });
  }, [state.ok]); // eslint-disable-line react-hooks/exhaustive-deps
  const color = colorOf(draft.color || promoDefaultColor(audience));
  const big = kind === 'MULTIPLIER' ? `${draft.multiplier.replace('.', ',')}x` : `+${parseInt(draft.bonus, 10) || 0}`;
  const dayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const when = [
    draft.days.length === 0 || draft.days.length === 7 ? 'Todos os dias' : draft.days.map((d) => dayNames[d]).join(', ').replace(/^./, (c) => c.toUpperCase()),
    draft.start && draft.end ? `das ${draft.start} às ${draft.end}` : draft.start ? `a partir das ${draft.start}` : draft.end ? `até as ${draft.end}` : '',
    parseFloat(draft.min.replace(',', '.')) > 0 ? `em compras a partir de R$ ${draft.min}` : '',
    audience === 'NEW' ? 'só na primeira compra' : audience === 'INACTIVE' ? 'para quem não compra há um tempo' : '',
  ].filter(Boolean).join(', ');
  const sx = init.id ? `-${init.id}` : '';
  const multOptions = MULTIPLIERS.includes(init.multiplier) || kind !== 'MULTIPLIER' ? MULTIPLIERS : [init.multiplier, ...MULTIPLIERS];
  return (
    <form
      action={action}
      className="space-y-4"
      key={edit ? undefined : (state.ok ?? 'idle')}
      onChange={(e) => {
        const fd = new FormData(e.currentTarget);
        setDraft({
          title: String(fd.get('title') ?? ''),
          multiplier: String(fd.get('multiplier') ?? '2'),
          bonus: String(fd.get('bonusPoints') ?? ''),
          color: String(fd.get('color') ?? ''),
          days: fd.getAll('weekdays').map(Number),
          start: String(fd.get('startTime') ?? ''),
          end: String(fd.get('endTime') ?? ''),
          min: String(fd.get('minAmount') ?? ''),
        });
      }}
    >
      {init.id && <input type="hidden" name="id" value={init.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor={`p-title${sx}`}>Nome da campanha</label>
          <input id={`p-title${sx}`} name="title" className="glass-input" placeholder="Ex.: Terça em dobro" defaultValue={v?.title ?? init.title} maxLength={60} required />
        </div>
        <div>
          <label className="glass-label" htmlFor={`p-kind${sx}`}>Tipo</label>
          <select id={`p-kind${sx}`} name="kind" className="glass-input" value={kind} onChange={(e) => setKind(e.target.value as 'MULTIPLIER' | 'BONUS')}>
            <option value="MULTIPLIER">Multiplicar os pontos da compra</option>
            <option value="BONUS">Dar pontos extras na compra</option>
          </select>
        </div>
        {kind === 'MULTIPLIER' ? (
          <div>
            <label className="glass-label" htmlFor={`p-mult${sx}`}>Multiplicador</label>
            <select id={`p-mult${sx}`} name="multiplier" className="glass-input" defaultValue={v?.multiplier ?? init.multiplier}>
              {multOptions.map((m) => (
                <option key={m} value={m}>{m === '2' ? '2x (pontos em dobro)' : m === '3' ? '3x (pontos em triplo)' : `${m.replace('.', ',')}x`}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="glass-label" htmlFor={`p-bonus${sx}`}>Pontos extras por compra</label>
            <input id={`p-bonus${sx}`} name="bonusPoints" type="number" min={1} inputMode="numeric" className="glass-input" placeholder="Ex.: 50" defaultValue={v?.bonusPoints ?? init.bonus} required />
          </div>
        )}
        <div>
          <label className="glass-label" htmlFor={`p-audience${sx}`}>Para quem</label>
          <select id={`p-audience${sx}`} name="audience" className="glass-input" value={audience} onChange={(e) => setAudience(e.target.value as 'ALL' | 'NEW' | 'INACTIVE')}>
            <option value="ALL">Todos os clientes</option>
            <option value="NEW">Só na primeira compra (clientes novos)</option>
            <option value="INACTIVE">Quem não compra há um tempo</option>
          </select>
        </div>
        {audience === 'INACTIVE' ? (
          <div>
            <label className="glass-label" htmlFor={`p-inactive${sx}`}>Sem comprar há (dias)</label>
            <input id={`p-inactive${sx}`} name="inactiveDays" type="number" min={7} max={365} inputMode="numeric" className="glass-input" defaultValue={v?.inactiveDays ?? init.inactiveDays} required />
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
        <div className="sm:col-span-2">
          <ColorSwatches name="color" value={init.color || null} label="Cor da campanha" hint="aparece no cartão do cliente; sem escolher, usamos azul (todos), verde (clientes novos) ou laranja (quem sumiu)" />
        </div>
        <div className="sm:col-span-2">
          <label className="glass-label" htmlFor={`p-min${sx}`}>Valor mínimo da compra (R$) <span className="font-normal text-slate-500">— opcional</span></label>
          <input id={`p-min${sx}`} name="minAmount" inputMode="decimal" className="glass-input" placeholder="Ex.: 40,00" defaultValue={v?.minAmount ?? init.min} />
        </div>
      </div>

      <fieldset>
        <legend className="glass-label">Dias da semana <span className="font-normal text-slate-500">— nenhum marcado = todos os dias</span></legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((d, i) => (
            <label key={d} className="inline-flex items-center gap-2 rounded-md border border-[#D5DAE3] bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 has-[:checked]:border-electric-500 has-[:checked]:bg-electric-500 has-[:checked]:text-white">
              <input type="checkbox" name="weekdays" value={i} defaultChecked={init.days.includes(i)} className="sr-only" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="glass-label" htmlFor={`p-start-time${sx}`}>Horário inicial <span className="font-normal text-slate-500">— opcional</span></label>
          <input id={`p-start-time${sx}`} name="startTime" type="time" className="glass-input" defaultValue={v?.startTime ?? init.start} />
        </div>
        <div>
          <label className="glass-label" htmlFor={`p-end-time${sx}`}>Horário final <span className="font-normal text-slate-500">— opcional</span></label>
          <input id={`p-end-time${sx}`} name="endTime" type="time" className="glass-input" defaultValue={v?.endTime ?? init.end} />
        </div>
        <div>
          <label className="glass-label" htmlFor={`p-start-date${sx}`}>Começa em <span className="font-normal text-slate-500">— opcional</span></label>
          <input id={`p-start-date${sx}`} name="startDate" type="date" className="glass-input" defaultValue={v?.startDate ?? init.startDate} />
        </div>
        <div>
          <label className="glass-label" htmlFor={`p-end-date${sx}`}>Termina em <span className="font-normal text-slate-500">— opcional</span></label>
          <input id={`p-end-date${sx}`} name="endDate" type="date" className="glass-input" defaultValue={v?.endDate ?? init.endDate} />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        A campanha vale no caixa, no horário de Brasília, e já aparece como card na vitrine “Lugares”. Multiplicadores não se somam (vale o maior); pontos extras se somam. Campanhas para um público específico (clientes novos ou quem sumiu) entram quando o cliente lê o QR Code, porque só então sabemos quem ele é.
      </p>
      <PreviewFrame where={WHERE_PROMO}>
        <div data-testid="promo-preview"><CampaignTile big={big} title={draft.title || 'Nome da campanha'} when={when} color={color} live /></div>
      </PreviewFrame>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant={edit ? 'primary' : 'ghost'} pendingText={edit ? 'Salvando…' : 'Criando…'} className={edit ? 'btn-sm' : ''}>{edit ? 'Salvar campanha' : 'Criar campanha'}</SubmitButton>
        {edit && <button type="button" className="glass-button-ghost btn-sm" onClick={onDone}>Cancelar</button>}
      </div>
    </form>
  );
}

export const AddPromotionForm = () => <PromotionForm />;

/**
 * Cartão de uma campanha da lista: o resumo vem de fora (`header`), com Editar, os botões do servidor (`actions`),
 * a indicação de onde aparece no app e a prévia de como o cliente vê.
 */
export function PromotionCard({ init, editable, header, actions, preview }: { init: PromoInit; editable: boolean; header: React.ReactNode; actions: React.ReactNode; preview: { big: string; title: string; when: string; color: ColorInfo; live: boolean } }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="glass-inset p-3" data-testid="promo-card">
      {header}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {editable && (
          <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-label={`Editar campanha ${preview.title}`} className="glass-button-ghost btn-sm inline-flex items-center gap-1.5">
            <Icon name="pencil" size={15} /> Editar
          </button>
        )}
        {actions}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500"><Icon name="phone" size={14} className="mt-px shrink-0" /> <span>Aparece no app: {WHERE_PROMO}.</span></p>
      <details className="mt-1.5">
        <summary className="link-inline cursor-pointer text-sm">Ver como o cliente vê</summary>
        <div className="mt-2">
          <PreviewFrame where={WHERE_PROMO}>
            <CampaignTile big={preview.big} title={preview.title} when={preview.when} color={preview.color} live={preview.live} />
          </PreviewFrame>
        </div>
      </details>
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <PromotionForm init={init} onDone={() => setOpen(false)} />
        </div>
      )}
    </li>
  );
}
