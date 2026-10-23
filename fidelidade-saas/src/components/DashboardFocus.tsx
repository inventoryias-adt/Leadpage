'use client';

import { useCallback, useState } from 'react';
import { WEEKDAYS } from '@/lib/insights';
import { formatBRL } from '@/lib/points';
import { DaySheet, SlotSheet } from './DashboardCharts';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type DayRow = { ymd: string; label: string; weekday: string; count: number; cents: number };

/** "Dia a dia": uma linha por dia com barra proporcional. Tocar na linha abre o detalhe do dia. */
export function DayList({ rows }: { rows: DayRow[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const close = useCallback(() => setSel(null), []);
  const max = Math.max(1, ...rows.map((r) => r.cents));
  return (
    <>
      <ul className="glass-panel divide-y divide-slate-100 !rounded-[20px]" data-testid="day-list">
        {rows.map((r) => (
          <li key={r.ymd}>
            <button type="button" onClick={() => setSel(r.ymd)} data-testid={`day-row-${r.ymd}`} className="card-link flex w-full items-center gap-3 px-4 py-2.5 text-left">
              <span className="w-[4.5rem] shrink-0">
                <span className="block text-sm font-bold text-slate-800">{r.label}</span>
                <span className="block text-[11px] capitalize text-slate-500">{r.weekday.slice(0, 3)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block h-2 overflow-hidden rounded-full bg-[#F1F3F6]">
                  <span className="block h-full rounded-full bg-electric-500" style={{ width: r.cents > 0 ? `${Math.max(4, (r.cents / max) * 100)}%` : '0%' }} />
                </span>
              </span>
              <span className="w-[6.5rem] shrink-0 text-right">
                <span className="block text-sm font-extrabold tabular-nums text-primary">{formatBRL(r.cents)}</span>
                <span className="block text-[11px] text-slate-500">{r.count === 0 ? 'sem vendas' : plural(r.count, 'compra', 'compras')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {sel && <DaySheet key={sel} ymd={sel} onClose={close} />}
    </>
  );
}

/**
 * Mapa de horários em tela cheia: uma coluna por dia da semana e uma linha por hora, com células grandes e o número de compras dentro.
 * Cabe na largura do celular, sem rolagem para o lado. Tocar numa célula abre o detalhe do horário.
 */
export function PeakGridFull({ grid, from, to }: { grid: number[][]; from: number; to: number }) {
  const [sel, setSel] = useState<{ dow: number; hour: number } | null>(null);
  const close = useCallback(() => setSel(null), []);
  const max = Math.max(1, ...grid.flat());
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const days = [1, 2, 3, 4, 5, 6, 0]; // segunda a domingo
  return (
    <>
      <div role="group" aria-label="Compras por hora e dia da semana" className="glass-panel space-y-1 !rounded-[20px] p-3" data-testid="peak-grid">
        <div className="grid grid-cols-[2.4rem_repeat(7,minmax(0,1fr))] gap-1 text-[11px] font-bold capitalize text-slate-500">
          <span />
          {days.map((d) => (<span key={d} className="text-center">{WEEKDAYS[d].slice(0, 3)}</span>))}
        </div>
        {hours.map((h) => (
          <div key={h} className="grid grid-cols-[2.4rem_repeat(7,minmax(0,1fr))] gap-1">
            <span className="self-center text-[11px] font-semibold tabular-nums text-slate-500">{h}h</span>
            {days.map((d) => {
              const count = grid[d][h];
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => setSel({ dow: d, hour: h })}
                  data-testid={`heat-${d}-${h}`}
                  aria-label={`${WEEKDAYS[d]}, ${h}h: ${plural(count, 'compra', 'compras')}`}
                  className={`flex h-9 items-center justify-center rounded-lg text-xs font-extrabold transition-shadow hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary ${count / max > 0.55 ? 'text-white' : 'text-primary'}`}
                  style={{ background: count === 0 ? '#F1F3F6' : `rgba(33, 80, 201, ${0.18 + 0.82 * (count / max)})` }}
                >
                  {count > 0 ? count : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {sel && <SlotSheet key={`${sel.dow}-${sel.hour}`} dow={sel.dow} hour={sel.hour} onClose={close} />}
    </>
  );
}

/** Melhores horários: lista curta; tocar abre o detalhe do horário. */
export function TopSlots({ items }: { items: { dow: number; hour: number; count: number }[] }) {
  const [sel, setSel] = useState<{ dow: number; hour: number } | null>(null);
  const close = useCallback(() => setSel(null), []);
  return (
    <>
      <ol className="glass-panel divide-y divide-slate-100 !rounded-[20px]" data-testid="top-slots">
        {items.map((s, i) => (
          <li key={`${s.dow}-${s.hour}`}>
            <button type="button" onClick={() => setSel({ dow: s.dow, hour: s.hour })} className="card-link flex w-full items-center gap-3 px-4 py-3 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-sm font-extrabold text-electric-600">{i + 1}</span>
              <span className="min-w-0 flex-1 font-bold text-slate-800">{cap(WEEKDAYS[s.dow])}, {s.hour}h às {s.hour + 1}h</span>
              <span className="chip-lima shrink-0">{plural(s.count, 'compra', 'compras')}</span>
            </button>
          </li>
        ))}
      </ol>
      {sel && <SlotSheet key={`${sel.dow}-${sel.hour}`} dow={sel.dow} hour={sel.hour} onClose={close} />}
    </>
  );
}
