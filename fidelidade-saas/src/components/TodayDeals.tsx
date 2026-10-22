'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatBRL } from '@/lib/points';
import { Carousel } from './Carousel';
import { Icon } from './Icons';
import { PlaceAvatar, RewardImage } from './Visual';

export type Deal = {
  placeId: string;
  placeName: string;
  logoUrl: string | null;
  /** Unidade a abrir no pedido (só quando o lugar tem mais de uma). */
  unitId: string | null;
  distance: string | null;
  itemId: string;
  name: string;
  priceCents: number;
  promoCents: number;
  imageUrl: string | null;
  endsText: string | null;
  stock: number | null;
  stockTotal: number | null;
};

const off = (d: Deal) => Math.max(1, Math.round((1 - d.promoCents / d.priceCents) * 100));
const orderHref = (d: Deal) => `/lugar/${d.placeId}/pedido?item=${d.itemId}${d.unitId ? `&unidade=${d.unitId}` : ''}`;

/** Selo de estoque: "Restam 15", ou "Últimas 3" quando está acabando. */
const stockLabel = (stock: number) => (stock <= 3 ? `Últimas ${stock}` : `Restam ${stock}`);

/**
 * "Promoções de hoje": carrossel com todo produto que está em promoção agora (foto, selo de quantas restam, preço novo e riscado).
 * Tocar abre os detalhes: quanto ainda resta, até quando vale e o botão para pedir.
 */
export function TodayDeals({ deals }: { deals: Deal[] }) {
  const [open, setOpen] = useState<Deal | null>(null);
  const primary = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    primary.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (deals.length === 0) return null;
  const shown = deals.slice(0, 20);
  const pct = open && open.stock != null && open.stockTotal ? Math.max(0, Math.min(100, Math.round((open.stock / open.stockTotal) * 100))) : null;

  return (
    <section aria-labelledby="promocoes-do-dia" className="space-y-3" data-testid="today-deals">
      <div className="flex items-end justify-between">
        <h2 id="promocoes-do-dia" className="text-[15px] font-bold text-slate-800">Promoções de hoje</h2>
        <span className="text-xs text-slate-500">{deals.length} {deals.length === 1 ? 'oferta' : 'ofertas'}</span>
      </div>

      <Carousel label="Promoções de hoje">
        {shown.map((d) => (
          <li key={`${d.placeId}-${d.itemId}`} className="w-[8.5rem] shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen(d)}
              data-testid="deal-card"
              className="group block w-full !bg-transparent !p-0 text-left !shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
              aria-label={`${d.name}, ${d.placeName}: de ${formatBRL(d.priceCents)} por ${formatBRL(d.promoCents)}${d.stock != null ? `, ${stockLabel(d.stock).toLowerCase()}` : ''}. Toque para ver`}
            >
              <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                <RewardImage src={d.imageUrl} name={d.name} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
                <span className="absolute left-2 top-2 rounded-full bg-[#C6F432] px-2 py-0.5 text-[11px] font-extrabold text-[#0F1F3D]">-{off(d)}%</span>
                {d.stock != null && (
                  <span data-testid="deal-stock" className={`absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white ${d.stock <= 3 ? 'bg-rose-600/90' : 'bg-[#0F1F3D]/85'}`}>{stockLabel(d.stock)}</span>
                )}
              </span>
              <span className="mt-2 block truncate text-sm font-bold text-slate-900">{d.name}</span>
              <span className="block truncate text-xs text-slate-500">{d.placeName}</span>
              <span className="mt-0.5 block">
                <span className="text-base font-extrabold text-primary">{formatBRL(d.promoCents)}</span>
                <span className="ml-1.5 text-xs font-medium text-slate-400 line-through">{formatBRL(d.priceCents)}</span>
              </span>
            </button>
          </li>
        ))}
      </Carousel>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 md:items-center md:p-6" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="oferta-titulo"
            data-testid="deal-modal"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-md animate-fade-in flex-col overflow-y-auto rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]"
          >
            <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-slate-100">
              <RewardImage src={open.imageUrl} name={open.name} className="h-full w-full" />
              <span className="absolute left-3 top-3 rounded-full bg-[#C6F432] px-3 py-1 text-sm font-extrabold text-[#0F1F3D]">-{off(open)}%</span>
              <button type="button" onClick={() => setOpen(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white" aria-label="Fechar">✕</button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <h3 id="oferta-titulo" className="text-xl font-extrabold leading-tight text-primary">{open.name}</h3>
                <p className="mt-1.5">
                  <span className="text-3xl font-extrabold text-primary">{formatBRL(open.promoCents)}</span>
                  <span className="ml-2 text-base font-medium text-slate-400 line-through">{formatBRL(open.priceCents)}</span>
                </p>
                {open.endsText && <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><Icon name="clock" size={15} /> {open.endsText}</p>}
              </div>

              {open.stock != null ? (
                <div data-testid="deal-remaining">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800">{open.stock <= 3 ? 'Está acabando!' : 'Quanto ainda resta'}</p>
                    <p className="text-sm font-extrabold text-primary">restam {open.stock}{open.stockTotal ? ` de ${open.stockTotal}` : ''}</p>
                  </div>
                  {pct != null && (
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Estoque restante da oferta">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: open.stock <= 3 ? '#E11D48' : '#0F1F3D' }} />
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-slate-500">Quando acabar, o produto volta ao preço normal.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-600" data-testid="deal-remaining">Sem limite de unidades enquanto a oferta estiver valendo.</p>
              )}

              <Link href={`/lugar/${open.placeId}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50" onClick={() => setOpen(null)}>
                <PlaceAvatar name={open.placeName} src={open.logoUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{open.placeName}</span>
                  {open.distance && <span className="block text-xs text-slate-500">{open.distance}</span>}
                </span>
                <Icon name="chevron" size={16} className="text-slate-400" />
              </Link>

              <div className="grid grid-cols-2 gap-2">
                <Link ref={primary} href={orderHref(open)} data-testid="deal-order" className="glass-button !rounded-full" onClick={() => setOpen(null)}>Pedir</Link>
                <button type="button" onClick={() => setOpen(null)} className="glass-button-ghost !rounded-full">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
