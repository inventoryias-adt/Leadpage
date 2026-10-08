'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { PERIODS, PERIOD_LABEL, type Activity, type Period } from '@/lib/activity';
import { formatPoints } from '@/lib/points';

/** Gráfico de área: pontos ganhos acumulados no período. Passe o mouse (ou toque) para ver cada coluna. */
function AreaChart({ activity, label }: { activity: Activity; label: string }) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  // largura real do cartão: assim o texto do gráfico mantém o tamanho no celular
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setW(Math.max(260, Math.round(el.clientWidth)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 420 ? 190 : 220;
  const padL = 38;
  const padB = 24;
  const padT = 12;
  const slots = activity.slots;
  const max = Math.max(1, slots[slots.length - 1]?.total ?? 0);
  const innerW = W - padL - 14;
  const innerH = H - padB - padT;
  const x = (i: number) => padL + (slots.length === 1 ? innerW : (i / (slots.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const line = slots.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(s.total).toFixed(1)}`).join(' ');
  const tickEvery = Math.max(1, Math.ceil(slots.length / (W < 420 ? 4 : 7)));
  const empty = activity.earned === 0 && activity.redeemed === 0;

  return (
    <div ref={box} className="relative">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2150C9" stopOpacity=".22" />
            <stop offset="1" stopColor="#2150C9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - 14} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke="#E5E7EB" strokeWidth="1" />
            <text x={padL - 6} y={padT + innerH * (1 - f) + 4} textAnchor="end" fontSize="11" fill="#64748B">{formatPoints(Math.round(max * f))}</text>
          </g>
        ))}
        <path d={`${line} L${x(slots.length - 1)} ${padT + innerH} L${x(0)} ${padT + innerH} Z`} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="#2150C9" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && <rect x={x(hover) - 1} y={padT} width={2} height={innerH} fill="#C7D6F7" />}
        {slots.map((s, i) => {
          const has = s.earned > 0 || s.redeemed > 0;
          const on = hover === i;
          return (
            <g key={i}>
              {(has || on) && <circle cx={x(i)} cy={y(s.total)} r={on ? 9 : 0} fill="#BFD0F7" />}
              {(has || on) && <circle cx={x(i)} cy={y(s.total)} r={on ? 6 : 4} fill={on ? '#1A3FA3' : '#0F1F3D'} stroke="#fff" strokeWidth={on ? 2.5 : 1.5} />}
              {(i % tickEvery === 0 || i === slots.length - 1) && (i === slots.length - 1 || slots.length - 1 - i >= tickEvery * 0.7) && (
                <text x={x(i)} y={H - 6} textAnchor={i === slots.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#64748B">{s.label}</text>
              )}
              <rect
                x={x(i) - Math.max(8, innerW / slots.length / 2)}
                y={padT}
                width={Math.max(16, innerW / slots.length)}
                height={innerH + padB - 6}
                fill="transparent"
                tabIndex={0}
                aria-label={`${s.label}: ganhou ${formatPoints(s.earned)} pontos, acumulado ${formatPoints(s.total)}`}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onTouchStart={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>
      {hover != null && slots[hover] && (
        <ChartTooltip leftPct={(x(hover) / W) * 100} topPct={(y(slots[hover].total) / H) * 100}>
          <p className="text-xs font-medium text-slate-500">{slots[hover].label}</p>
          <p className="text-lg font-semibold leading-tight text-primary">+{formatPoints(slots[hover].earned)} pts</p>
          <p className="text-xs text-slate-600">
            {slots[hover].redeemed > 0 ? `−${formatPoints(slots[hover].redeemed)} pts usados · ` : ''}acumulado {formatPoints(slots[hover].total)}
          </p>
        </ChartTooltip>
      )}
      {empty && <p className="absolute inset-x-0 top-1/3 text-center text-sm font-semibold text-slate-500">Nenhuma movimentação neste período</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 sm:border-l sm:border-[#E5E7EB] sm:px-4 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-primary sm:text-2xl">{value}</p>
    </div>
  );
}

export function PointsActivity({ data, balance, places }: { data: Record<Period, Activity>; balance: number; places: number }) {
  const [period, setPeriod] = useState<Period>('semana');
  const a = data[period];
  return (
    <div className="glass-panel space-y-4 p-4 sm:p-6">
      <div>
        <p className="text-sm text-slate-500">Pontos ganhos</p>
        <p className="text-4xl font-semibold tracking-tight text-primary" aria-live="polite">{formatPoints(a.earned)}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Período do gráfico">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors ${period === p ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      <AreaChart activity={a} label={`Pontos ganhos acumulados: ${PERIOD_LABEL[period]}`} />
      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-[#E5E7EB] p-4 sm:flex sm:gap-0">
        <Stat label="Pontuações" value={formatPoints(a.earnCount)} />
        <Stat label="Resgates" value={formatPoints(a.redeemCount)} />
        <Stat label="Saldo atual" value={formatPoints(balance)} />
        <Stat label={places === 1 ? 'Lugar' : 'Lugares'} value={formatPoints(places)} />
      </div>
    </div>
  );
}
