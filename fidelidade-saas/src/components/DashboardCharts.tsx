'use client';

import { useState } from 'react';
import { ChartTooltip } from './ChartTooltip';
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

/** Barras de vendas por dia. Passe o mouse (ou toque) numa barra para ver o dia, o valor e as compras. */
export function SalesBars({ days }: { days: DayBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 190;
  const padL = 44;
  const padB = 26;
  const padT = 10;
  const max = Math.max(1, ...days.map((d) => d.cents));
  const innerW = W - padL - 6;
  const innerH = H - padB - padT;
  const slot = innerW / days.length;
  const bar = Math.max(2, Math.min(26, slot * 0.7));
  const avg = days.reduce((n, d) => n + d.cents, 0) / days.length;
  const y = (c: number) => padT + innerH - (c / max) * innerH;
  const tickEvery = Math.ceil(days.length / 7);
  const money = (c: number) => (c >= 100000 ? `R$ ${Math.round(c / 100000)} mil` : formatBRL(c).replace(',00', ''));
  const weekday = (ymd: string) => WEEKDAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()];
  const hd = hover != null ? days[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Vendas lançadas por dia" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - 6} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke="#E5E7EB" strokeWidth="1" />
            <text x={padL - 6} y={padT + innerH * (1 - f) + 4} textAnchor="end" fontSize="10" fill="#64748B">{f === 0 ? '0' : money(max * f)}</text>
          </g>
        ))}
        {hover != null && <rect x={padL + hover * slot} y={padT} width={slot} height={innerH} fill="#E8EEFB" />}
        {days.map((d, i) => {
          const x = padL + i * slot + (slot - bar) / 2;
          const h = Math.max(d.cents > 0 ? 3 : 0, innerH - (y(d.cents) - padT));
          const on = hover === i;
          return (
            <g key={d.ymd}>
              {on && h > 0 && <rect x={x - 3} y={padT + innerH - h - 3} width={bar + 6} height={h + 3} rx={Math.min(5, bar / 2 + 2)} fill="#BFD0F7" />}
              <rect
                x={x}
                y={padT + innerH - h}
                width={bar}
                height={h}
                rx={Math.min(3, bar / 2)}
                fill={on ? '#1A3FA3' : i === days.length - 1 ? '#0F1F3D' : '#2150C9'}
                stroke={on ? '#fff' : 'none'}
                strokeWidth="2"
              />
              {i % tickEvery === 0 && (
                <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748B">{d.label}</text>
              )}
              {/* área de toque: a coluna inteira, para os dias sem venda também responderem */}
              <rect
                x={padL + i * slot}
                y={padT}
                width={slot}
                height={innerH + padB - 6}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${formatBRL(d.cents)}, ${d.count} ${d.count === 1 ? 'compra' : 'compras'}`}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onTouchStart={() => setHover(i)}
              />
            </g>
          );
        })}
        {avg > 0 && (
          <g pointerEvents="none">
            <line x1={padL} x2={W - 6} y1={y(avg)} y2={y(avg)} stroke="#94A3B8" strokeWidth="1.25" strokeDasharray="4 4" />
            <text x={padL + 6} y={y(avg) - 4} textAnchor="start" fontSize="10" fontWeight="500" fill="#64748B">média {money(avg)}/dia</text>
          </g>
        )}
      </svg>
      {hd && hover != null && (
        <ChartTooltip leftPct={((padL + hover * slot + slot / 2) / W) * 100} topPct={(Math.max(padT + 14, y(hd.cents)) / H) * 100}>
          <p className="text-xs font-medium capitalize text-slate-500">{weekday(hd.ymd)}, {hd.label}</p>
          <p className="text-lg font-semibold leading-tight text-primary">{formatBRL(hd.cents)}</p>
          <p className="text-xs text-slate-600">
            {hd.count === 0 ? 'Sem vendas neste dia' : `${hd.count} ${hd.count === 1 ? 'compra' : 'compras'} · ${formatPoints(hd.points)} pts`}
          </p>
        </ChartTooltip>
      )}
    </div>
  );
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
