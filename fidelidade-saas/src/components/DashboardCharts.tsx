'use client';

import { AreaChart, type AreaPoint } from './AreaChart';
import { WEEKDAYS, type DayBucket } from '@/lib/insights';
import { formatBRL, formatPoints } from '@/lib/points';

/** Cartão de número com variação em relação ao período anterior. */
export function KpiCard({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: number | null }) {
  return (
    <div className="glass-panel-sm h-full p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        {delta != null && (
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${delta >= 0 ? 'bg-blue-100 text-electric-600' : 'bg-rose-100 text-rose-600'}`} title="Em relação ao período anterior">
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <p className="mt-1 text-3xl font-extrabold leading-tight text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Vendas por dia no gráfico de área padrão: passe o mouse (ou toque) para ver o dia, o valor e as compras. */
export function SalesArea({ days }: { days: DayBucket[] }) {
  const weekday = (ymd: string) => WEEKDAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()];
  const points: AreaPoint[] = days.map((d) => ({
    label: d.label,
    value: d.cents,
    active: d.count > 0,
    title: `${weekday(d.ymd)}, ${d.label}`,
    strong: formatBRL(d.cents),
    lines: [d.count === 0 ? 'Sem vendas neste dia' : `${d.count} ${d.count === 1 ? 'compra' : 'compras'} · ${formatPoints(d.points)} pts`],
  }));
  return <AreaChart points={points} label="Vendas lançadas por dia" yKind="money" empty="Sem vendas no período" />;
}

/** Mapa de calor: dias da semana × horas. Quanto mais escuro, mais compras. */
export function PeakHeatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <div role="img" aria-label="Compras por dia da semana e horário" className="space-y-1">
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
            <span
              key={h}
              title={`${WEEKDAYS[dow]}, ${h}h: ${count} ${count === 1 ? 'compra' : 'compras'}`}
              className="aspect-square cursor-pointer rounded-[3px] transition-shadow hover:ring-2 hover:ring-primary hover:ring-offset-1"
              style={{ background: count === 0 ? '#F1F3F6' : `rgba(33, 80, 201, ${0.18 + 0.82 * (count / max)})` }}
            />
          ))}
        </div>
      ))}
    </div>
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
