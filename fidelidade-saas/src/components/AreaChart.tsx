'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { formatBRL, formatPoints } from '@/lib/points';

/** Um ponto do gráfico. Tudo em texto/número simples, para poder vir de um componente de servidor. */
export type AreaPoint = {
  label: string; // rótulo do eixo (hora ou dia)
  value: number; // valor plotado
  active?: boolean; // desenha a bolinha (houve movimento)
  title: string; // 1ª linha da dica (ex.: "Quinta, 08/10")
  strong: string; // valor em destaque na dica
  lines?: string[]; // linhas de apoio na dica
};

const money = (c: number) => (c >= 100000 ? `R$ ${Math.round(c / 100000)} mil` : formatBRL(c).replace(',00', ''));

/**
 * Gráfico de área padrão do Fidelize (perfil do cliente, início do restaurante e visão geral do admin):
 * linha azul com degradê, bolinhas nos pontos com movimento e dica imediata ao passar o mouse ou tocar.
 */
export function AreaChart({ points, label, yKind = 'number', empty }: { points: AreaPoint[]; label: string; yKind?: 'number' | 'money'; empty?: string }) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  // Largura real do cartão: assim o texto do gráfico mantém o tamanho no celular.
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
  const padL = yKind === 'money' ? 52 : 38;
  const padB = 24;
  const padT = 12;
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));
  const innerW = W - padL - 14;
  const innerH = H - padB - padT;
  const x = (i: number) => padL + (n === 1 ? innerW : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const fmt = (v: number) => (yKind === 'money' ? money(v) : formatPoints(Math.round(v)));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const tickEvery = Math.max(1, Math.ceil(n / (W < 420 ? 4 : 7)));
  const isEmpty = points.every((p) => !p.active && p.value === 0);
  const hp = hover != null ? points[hover] : null;

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
            <text x={padL - 6} y={padT + innerH * (1 - f) + 4} textAnchor="end" fontSize="11" fill="#64748B">{f === 0 ? '0' : fmt(max * f)}</text>
          </g>
        ))}
        <path d={`${line} L${x(n - 1)} ${padT + innerH} L${x(0)} ${padT + innerH} Z`} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="#2150C9" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && <rect x={x(hover) - 1} y={padT} width={2} height={innerH} fill="#C7D6F7" />}
        {points.map((p, i) => {
          const on = hover === i;
          const dot = p.active || on;
          return (
            <g key={i}>
              {on && <circle cx={x(i)} cy={y(p.value)} r={9} fill="#BFD0F7" />}
              {dot && <circle cx={x(i)} cy={y(p.value)} r={on ? 6 : 4} fill={on ? '#1A3FA3' : '#0F1F3D'} stroke="#fff" strokeWidth={on ? 2.5 : 1.5} />}
              {(i % tickEvery === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= tickEvery * 0.7) && (
                <text x={x(i)} y={H - 6} textAnchor={i === n - 1 ? 'end' : 'middle'} fontSize="11" fill="#64748B">{p.label}</text>
              )}
              {/* área de toque: a faixa inteira, para os pontos sem movimento também responderem */}
              <rect
                x={x(i) - Math.max(8, innerW / n / 2)}
                y={padT}
                width={Math.max(16, innerW / n)}
                height={innerH + padB - 6}
                fill="transparent"
                tabIndex={0}
                aria-label={`${p.title}: ${p.strong}`}
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
      {hp && hover != null && (
        <ChartTooltip leftPct={(x(hover) / W) * 100} topPct={(y(hp.value) / H) * 100}>
          <p className="text-xs font-medium capitalize text-slate-500">{hp.title}</p>
          <p className="text-lg font-semibold leading-tight text-primary">{hp.strong}</p>
          {hp.lines?.map((l) => (
            <p key={l} className="text-xs text-slate-600">{l}</p>
          ))}
        </ChartTooltip>
      )}
      {isEmpty && empty && <p className="absolute inset-x-0 top-1/3 text-center text-sm font-semibold text-slate-500">{empty}</p>}
    </div>
  );
}
