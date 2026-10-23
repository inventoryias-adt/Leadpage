'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { loadDayDetail, loadSlotDetail, type DayView, type SlotView } from '@/app/actions/dash-detail';
import { AreaChart, type AreaPoint } from './AreaChart';
import { DetailSheet, Stat } from './DetailSheet';
import { WEEKDAYS, type DayBucket } from '@/lib/insights';
import { formatBRL, formatPoints } from '@/lib/points';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const ymdBr = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** Cartão de número com variação em relação ao período anterior. */
export function KpiCard({ label, value, hint, delta, exact }: { label: string; value: string; hint?: string; delta?: number | null; exact?: string }) {
  // Valor grande não pode quebrar nem vazar da célula no celular (duas colunas).
  const size = value.length > 9 ? 'text-xl sm:text-2xl' : value.length > 6 ? 'text-2xl sm:text-3xl' : 'text-[1.75rem] sm:text-3xl';
  return (
    <div className="h-full min-w-0 px-4 py-4 sm:px-5" title={exact}>
      <p className="min-w-0 text-xs font-bold leading-snug text-slate-500">{label}</p>
      <p className={`mt-1 whitespace-nowrap font-extrabold leading-tight tracking-tight text-primary tabular-nums ${size}`}>{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {delta != null && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${delta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`} title="Em relação ao período anterior">
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta)}%
          </span>
        )}
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}

/** Vendas por dia no gráfico de área padrão: passe o mouse (ou toque) para ver o dia; clique para ver o que aconteceu nele. */
export function SalesArea({ days }: { days: DayBucket[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const close = useCallback(() => setSel(null), []);
  const weekday = (ymd: string) => WEEKDAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()];
  const points: AreaPoint[] = days.map((d) => ({
    label: d.label,
    value: d.cents,
    active: d.count > 0,
    title: `${weekday(d.ymd)}, ${d.label}`,
    strong: formatBRL(d.cents),
    lines: [d.count === 0 ? 'Sem vendas neste dia' : `${d.count} ${d.count === 1 ? 'compra' : 'compras'} · ${formatPoints(d.points)} pts`, 'Toque para ver os detalhes'],
  }));
  return (
    <>
      <AreaChart points={points} label="Vendas lançadas por dia" yKind="money" empty="Sem vendas no período" onSelect={(i) => setSel(days[i].ymd)} />
      {sel && <DaySheet key={sel} ymd={sel} onClose={close} />}
    </>
  );
}

/** O que aconteceu em um dia: números, comparação com a semana anterior, possíveis motivos e as compras do dia. */
function DaySheet({ ymd, onClose }: { ymd: string; onClose: () => void }) {
  const [view, setView] = useState<DayView | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    loadDayDetail(ymd).then((v) => on && setView(v)).catch(() => on && setView(null));
    return () => { on = false; };
  }, [ymd]);
  const d = view?.detail;
  const title = d?.title ?? `Dia ${ymdBr(ymd)}`;
  return (
    <DetailSheet title={title} onClose={onClose}>
      {view === undefined && <p className="py-6 text-center text-sm text-slate-500" role="status">Carregando o dia…</p>}
      {view === null && <p className="py-6 text-center text-sm text-slate-500">Não foi possível carregar este dia.</p>}
      {d && view && (
        <div className="space-y-5" data-testid="day-detail">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Vendas" value={formatBRL(d.cents)} hint={d.prevWeek.cents > 0 ? `semana anterior: ${formatBRL(d.prevWeek.cents)}` : undefined} />
            <Stat label="Compras" value={String(d.count)} hint={`semana anterior: ${d.prevWeek.count}`} />
            <Stat label="Ticket médio" value={d.count ? formatBRL(d.ticketCents) : '—'} />
            <Stat label="Pontos dados" value={formatPoints(d.points)} />
          </div>
          <section aria-label="O que pode explicar">
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">O que pode explicar</h4>
            <ul className="space-y-1.5 text-sm text-slate-700" data-testid="day-reasons">
              {view.reasons.map((r) => (
                <li key={r} className="flex gap-2"><span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500" />{r}</li>
              ))}
            </ul>
          </section>
          {d.purchases.length > 0 && (
            <section aria-label="Compras do dia">
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Compras do dia</h4>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {d.purchases.slice(0, 8).map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{p.who}</span><span className="text-xs text-slate-500">{p.time} · +{formatPoints(p.points)} pts</span></span>
                    <span className="shrink-0 font-bold text-primary tabular-nums">{formatBRL(p.cents)}</span>
                  </li>
                ))}
              </ul>
              {d.purchases.length > 8 && <p className="mt-1 text-xs text-slate-500">e mais {d.purchases.length - 8} compras</p>}
            </section>
          )}
          {d.redemptions.length > 0 && (
            <section aria-label="Prêmios do dia">
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Prêmios resgatados</h4>
              <ul className="space-y-1 text-sm text-slate-700">
                {d.redemptions.slice(0, 5).map((r, i) => (<li key={i}><b className="text-slate-800">{r.who}</b> · {r.what} <span className="text-xs text-slate-500">({r.status})</span></li>))}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Link href={`/dashboard/caixa?de=${ymd}&ate=${ymd}#lancamentos`} className="glass-button-ghost btn-sm">Abrir no Caixa</Link>
            {d.redemptions.length > 0 && <Link href={`/dashboard/resgates?st=todos&de=${ymd}&ate=${ymd}`} className="glass-button-ghost btn-sm">Ver resgates do dia</Link>}
            <Link href="/dashboard/configuracoes?etapa=regras&abrir=campanhas#campanhas" className="glass-button-navy btn-sm">Criar campanha</Link>
          </div>
        </div>
      )}
    </DetailSheet>
  );
}

/** Mapa de calor: dias da semana × horas. Quanto mais escuro, mais compras. Toque num horário para ver o detalhe. */
export function PeakHeatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const [sel, setSel] = useState<{ dow: number; hour: number } | null>(null);
  const close = useCallback(() => setSel(null), []);
  return (
    <div className="space-y-1">
      {/* no celular as células ficam em tamanho de dedo e o mapa rola para o lado */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div role="group" aria-label="Compras por dia da semana e horário. Toque num horário para ver o detalhe" className="min-w-[560px] space-y-1 sm:min-w-0">
        <div className="grid grid-cols-[2.2rem_repeat(24,minmax(0,1fr))] gap-[2px] text-[9px] text-slate-500">
          <span />
          {hours.map((h) => (
            <span key={h} className="text-center">{h % 3 === 0 ? h : ''}</span>
          ))}
        </div>
        {grid.map((row, dow) => (
          <div key={dow} className="grid grid-cols-[2.2rem_repeat(24,minmax(0,1fr))] gap-[2px]">
            <span className="self-center text-[10px] font-semibold capitalize text-slate-600">{WEEKDAYS[dow].slice(0, 3)}</span>
            {row.map((count, h) => (
              <button
                type="button"
                key={h}
                onClick={() => setSel({ dow, hour: h })}
                title={`${WEEKDAYS[dow]}, ${h}h: ${count} ${count === 1 ? 'compra' : 'compras'}`}
                aria-label={`${WEEKDAYS[dow]}, ${h}h: ${plural(count, 'compra', 'compras')}`}
                data-testid={`heat-${dow}-${h}`}
                className="aspect-square cursor-pointer rounded-[3px] transition-shadow hover:ring-2 hover:ring-primary hover:ring-offset-1 focus-visible:ring-2 focus-visible:ring-primary"
                style={{ background: count === 0 ? '#F1F3F6' : `rgba(33, 80, 201, ${0.18 + 0.82 * (count / max)})` }}
              />
            ))}
          </div>
        ))}
      </div>
      </div>
      <p className="pt-1 text-xs text-slate-500">Toque num horário para ver quando e quem comprou.</p>
      {sel && <SlotSheet key={`${sel.dow}-${sel.hour}`} dow={sel.dow} hour={sel.hour} onClose={close} />}
    </div>
  );
}

/** Um horário do mapa: quantas compras, em que datas, quem mais comprou e o que fazer com ele. */
function SlotSheet({ dow, hour, onClose }: { dow: number; hour: number; onClose: () => void }) {
  const [view, setView] = useState<SlotView | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    loadSlotDetail(dow, hour).then((v) => on && setView(v)).catch(() => on && setView(null));
    return () => { on = false; };
  }, [dow, hour]);
  const d = view?.detail;
  const title = `${WEEKDAYS[dow][0].toUpperCase()}${WEEKDAYS[dow].slice(1)}, ${hour}h às ${hour + 1}h`;
  return (
    <DetailSheet title={title} onClose={onClose}>
      {view === undefined && <p className="py-6 text-center text-sm text-slate-500" role="status">Carregando o horário…</p>}
      {view === null && <p className="py-6 text-center text-sm text-slate-500">Não foi possível carregar este horário.</p>}
      {d && view && (
        <div className="space-y-5" data-testid="slot-detail">
          <p className="text-xs text-slate-500">Últimos 90 dias.</p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Compras" value={String(d.count)} />
            <Stat label="Vendas" value={formatBRL(d.cents)} />
            <Stat label="Ticket médio" value={d.count ? formatBRL(d.ticketCents) : '—'} />
          </div>
          <section aria-label="Dicas">
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">O que isso diz</h4>
            <ul className="space-y-1.5 text-sm text-slate-700" data-testid="slot-tips">
              {view.tips.map((t) => (
                <li key={t} className="flex gap-2"><span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500" />{t}</li>
              ))}
            </ul>
          </section>
          {d.recent.length > 0 && (
            <section aria-label="Últimas vezes">
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Últimas vezes</h4>
              <ul className="flex flex-wrap gap-2">
                {d.recent.map((r) => (
                  <li key={r.ymd} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{r.label} · {plural(r.count, 'compra', 'compras')}</li>
                ))}
              </ul>
            </section>
          )}
          {d.topClients.length > 0 && (
            <section aria-label="Quem mais compra">
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Quem mais compra neste horário</h4>
              <ul className="space-y-1 text-sm text-slate-700">
                {d.topClients.map((c) => (<li key={c.who}><b className="text-slate-800">{c.who}</b> · {plural(c.count, 'compra', 'compras')}</li>))}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Link href="/dashboard/configuracoes?etapa=regras&abrir=campanhas#campanhas" className="glass-button-navy btn-sm">Criar campanha</Link>
          </div>
        </div>
      )}
    </DetailSheet>
  );
}

/** Lista com barra proporcional (ex.: prêmios mais resgatados). */
export function BarList({ items, unit }: { items: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="rounded-lg border border-transparent p-1.5 transition-colors hover:border-slate-300 hover:bg-[#EDF0F5]">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-slate-800">{i.label}</span>
            <span className="shrink-0 text-slate-600">{i.value} {unit}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F1F3F6]">
            <div className="h-full rounded-full bg-electric-500" style={{ width: `${Math.max(4, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
