'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CampaignItem } from '@/lib/campaigns';
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

/** Campanhas de pontos rolando agora. Tocar no card abre a pergunta "quer participar?" com o nome do estabelecimento. */
export function CampaignCards({ items, loggedIn }: { items: CampaignView[]; loggedIn: boolean }) {
  const [open, setOpen] = useState<CampaignView | null>(null);
  const primary = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    primary.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (items.length === 0) return null;
  const shown = items.slice(0, 12);

  return (
    <section aria-labelledby="campanhas" className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 id="campanhas" className="font-bold text-slate-800">Campanhas rolando agora</h2>
        <span className="text-sm text-slate-500">{items.length} {items.length === 1 ? 'campanha' : 'campanhas'}</span>
      </div>

      <Carousel label="Campanhas">
        {shown.map((c) => {
          const look = LOOK[c.kind];
          return (
            <li key={`${c.placeId}-${c.id}`} className="w-[15.5rem] shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setOpen(c)}
                className="card-link relative flex h-full min-h-[10rem] w-full flex-col justify-between gap-3 rounded-xl border border-slate-200 border-t-2 border-t-electric-500 bg-white p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
                aria-label={`${look.label} de ${c.placeName}: ${c.title}, ${c.badge ?? `mais ${c.points} pontos`}. Toque para ver`}
              >
                <span className="relative inline-flex w-fit items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <Icon name={look.icon} size={13} /> {look.label}{c.live ? ' · agora' : ''}
                </span>
                <span className="relative">
                  <span className="block text-3xl font-semibold leading-none text-primary">
                    {c.badge ? c.badge.replace(/ pontos$/, '') : `+${formatPoints(c.points)}`} <span className="text-base font-medium text-slate-500">pts</span>
                  </span>
                  <span className="mt-1.5 line-clamp-2 block text-sm font-medium leading-snug text-slate-700">{c.title}</span>
                </span>
                <span className="relative flex items-center gap-2">
                  <PlaceAvatar name={c.placeName} src={c.logoUrl} size={24} />
                  <span className="truncate text-xs font-medium text-slate-600">{c.placeName}</span>
                </span>
              </button>
            </li>
          );
        })}
      </Carousel>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 md:items-center md:p-6" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="campanha-titulo"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md animate-fade-in rounded-t-xl bg-white p-5 shadow-2xl md:rounded-xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <PlaceAvatar name={open.placeName} src={open.logoUrl} size={52} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{LOOK[open.kind].label} de</p>
                <p className="truncate text-lg font-extrabold text-primary">{open.placeName}</p>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="glass-button-ghost btn-sm !px-3" aria-label="Fechar">✕</button>
            </div>

            <div className="mb-4 rounded-lg border border-slate-200 border-l-4 border-l-electric-500 bg-slate-50 p-4">
              <p className="text-3xl font-semibold leading-none text-primary">{open.badge ?? `+${formatPoints(open.points)} pontos`}</p>
              <p id="campanha-titulo" className="mt-1.5 text-sm font-medium text-slate-700">{open.title}</p>
            </div>

            <p className="mb-5 text-sm text-slate-600">{open.how}</p>

            <p className="mb-2 text-center text-sm font-bold text-slate-800">Quer participar da campanha do {open.placeName}?</p>
            <div className="space-y-2">
              <Link
                ref={primary}
                href={loggedIn ? `/lugar/${open.placeId}#${open.anchor}` : `/entrar?next=${encodeURIComponent(`/lugar/${open.placeId}`)}`}
                className="glass-button"
                onClick={() => setOpen(null)}
              >
                {loggedIn ? 'Quero participar' : 'Entrar para participar'}
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/lugar/${open.placeId}`} className="glass-button-ghost btn-sm">Ver o lugar</Link>
                <button type="button" onClick={() => setOpen(null)} className="glass-button-ghost btn-sm">Agora não</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
