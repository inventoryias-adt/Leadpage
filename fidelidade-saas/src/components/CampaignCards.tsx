'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CampaignItem } from '@/lib/campaigns';
import { colorOf } from '@/lib/palette';
import { formatPoints } from '@/lib/points';
import { Carousel } from './Carousel';
import { Icon, type IconName } from './Icons';
import { PlaceAvatar } from './Visual';

export type CampaignView = CampaignItem & { placeId: string; placeName: string; logoUrl: string | null };

const LOOK: Record<CampaignItem['kind'], { label: string; icon: IconName }> = {
  desafio: { label: 'Desafio', icon: 'trophy' },
  checkin: { label: 'Check-in', icon: 'pin' },
  indicacao: { label: 'Indicação', icon: 'users' },
  promocao: { label: 'Campanha', icon: 'spark' },
};

const headline = (c: CampaignItem) => (c.badge ? c.badge : `+${formatPoints(c.points)} pts`);

type Group = { placeId: string; placeName: string; logoUrl: string | null; items: CampaignView[] };

/**
 * Campanhas rolando, uma por estabelecimento: cada cartão mostra só o lugar e quantas campanhas ele tem; ao tocar,
 * abre a lista das campanhas daquele lugar (com o "como funciona" e o convite para participar).
 */
export function CampaignCards({ items, loggedIn }: { items: CampaignView[]; loggedIn: boolean }) {
  const [open, setOpen] = useState<Group | null>(null);
  const primary = useRef<HTMLAnchorElement>(null);

  const groups = useMemo(() => {
    const by = new Map<string, Group>();
    for (const c of items) {
      const g = by.get(c.placeId) ?? { placeId: c.placeId, placeName: c.placeName, logoUrl: c.logoUrl, items: [] };
      g.items.push(c);
      by.set(c.placeId, g);
    }
    // Quem tem campanha valendo agora e mais campanhas aparece primeiro.
    return [...by.values()].sort((a, b) => Number(b.items.some((i) => i.live)) - Number(a.items.some((i) => i.live)) || b.items.length - a.items.length);
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    primary.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="campanhas" className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 id="campanhas" className="font-bold text-slate-800">Campanhas por lugar</h2>
        <span className="text-sm text-slate-500">{groups.length} {groups.length === 1 ? 'lugar' : 'lugares'}</span>
      </div>

      <Carousel label="Campanhas por lugar">
        {groups.slice(0, 16).map((g) => (
          <li key={g.placeId} className="w-[14.5rem] shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen(g)}
              className="card-link flex h-full min-h-[9.5rem] w-full flex-col justify-between gap-4 rounded-[22px] border border-slate-200 bg-white p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
              aria-label={`${g.placeName}: ${g.items.length} ${g.items.length === 1 ? 'campanha' : 'campanhas'} rolando. Toque para ver`}
            >
              <span className="flex items-center gap-2.5">
                <PlaceAvatar name={g.placeName} src={g.logoUrl} size={40} />
                <span className="min-w-0 truncate text-sm font-bold text-slate-900">{g.placeName}</span>
              </span>
              {/* A contagem e um quadradinho colorido por campanha: o detalhe fica na lista que abre ao tocar. */}
              <span className="block">
                <span className="block text-2xl font-bold leading-none text-primary">{g.items.length} {g.items.length === 1 ? 'campanha' : 'campanhas'}</span>
                <span className="mt-3 flex items-center justify-between gap-2">
                  <span aria-hidden className="flex min-w-0 items-center gap-1.5">
                    {g.items.slice(0, 4).map((c) => (
                      <span key={c.id} className="flex h-8 min-w-8 items-center justify-center rounded-xl px-1.5 text-xs font-extrabold text-white" style={{ background: colorOf(c.color).hex }}>{c.big}</span>
                    ))}
                    {g.items.length > 4 && <span className="text-xs font-bold text-slate-500">+{g.items.length - 4}</span>}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-electric-600"><Icon name="chevron" size={16} /></span>
                </span>
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
            aria-labelledby="campanha-titulo"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-md animate-fade-in flex-col rounded-t-[28px] bg-white p-5 shadow-2xl md:rounded-[28px]"
          >
            <div className="mb-4 flex items-center gap-3">
              <PlaceAvatar name={open.placeName} src={open.logoUrl} size={52} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{open.items.length} {open.items.length === 1 ? 'campanha' : 'campanhas'} em</p>
                <p id="campanha-titulo" className="truncate text-lg font-extrabold text-primary">{open.placeName}</p>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Fechar">✕</button>
            </div>

            <ul className="-mx-1 mb-4 min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
              {open.items.map((c) => {
                const look = LOOK[c.kind];
                const color = colorOf(c.color);
                return (
                  <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_4px_14px_rgba(15,31,61,0.05)]">
                    <div className="flex items-center gap-3.5">
                      <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-center font-extrabold leading-none text-white" style={{ background: color.hex, fontSize: c.big.length > 4 ? 16 : c.big.length > 3 ? 19 : 23 }}>{c.big}</span>
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: color.hex }}>
                          <Icon name={look.icon} size={13} /> {look.label}{c.live ? ' · agora' : ''}
                        </span>
                        <p className="font-bold leading-tight text-slate-800">{c.title}</p>
                        <p className="text-sm font-semibold text-slate-500">{headline(c)}</p>
                      </div>
                    </div>
                    <p className="mt-2.5 text-xs text-slate-600">{c.how}</p>
                    <Link href={loggedIn ? `/lugar/${open.placeId}#${c.anchor}` : `/entrar?next=${encodeURIComponent(`/lugar/${open.placeId}`)}`} className="link-inline mt-2 inline-flex items-center gap-1 text-sm" onClick={() => setOpen(null)}>
                      {loggedIn ? 'Quero participar' : 'Entrar para participar'} <Icon name="chevron" size={14} />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="grid grid-cols-2 gap-2">
              <Link ref={primary} href={`/lugar/${open.placeId}`} className="glass-button !rounded-full" onClick={() => setOpen(null)}>Ver o lugar</Link>
              <button type="button" onClick={() => setOpen(null)} className="glass-button-ghost !rounded-full">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
