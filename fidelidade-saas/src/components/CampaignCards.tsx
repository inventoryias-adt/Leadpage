'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CampaignItem } from '@/lib/campaigns';
import { formatPoints } from '@/lib/points';
import { Carousel } from './Carousel';
import { Icon, type IconName } from './Icons';
import { PlaceAvatar } from './Visual';

export type CampaignView = CampaignItem & { placeId: string; placeName: string; logoUrl: string | null };

const LOOK: Record<CampaignItem['kind'], { label: string; icon: IconName; bg: string }> = {
  desafio: { label: 'Desafio', icon: 'trophy', bg: 'linear-gradient(140deg, #3B78FF 0%, #1A43C7 100%)' },
  checkin: { label: 'Check-in', icon: 'pin', bg: 'linear-gradient(140deg, #22B573 0%, #0E7A4B 100%)' },
  indicacao: { label: 'Indicação', icon: 'users', bg: 'linear-gradient(140deg, #8B5CF6 0%, #5B21B6 100%)' },
  promocao: { label: 'Campanha', icon: 'spark', bg: 'linear-gradient(140deg, #FFB22E 0%, #E8590C 100%)' },
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
                className="relative flex h-full min-h-[10.5rem] w-full flex-col justify-between gap-3 overflow-hidden rounded-3xl p-4 text-left text-white shadow-lg shadow-blue-900/15 transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
                style={{ background: look.bg }}
                aria-label={`${look.label} de ${c.placeName}: ${c.title}, ${c.badge ?? `mais ${c.points} pontos`}. Toque para ver`}
              >
                <Icon name={look.icon} size={92} className="pointer-events-none absolute -bottom-4 -right-3 text-white/15" />
                <span className="relative inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
                  <Icon name={look.icon} size={13} /> {look.label}{c.live ? ' · agora' : ''}
                </span>
                <span className="relative">
                  <span className="block text-3xl font-extrabold leading-none">
                    {c.badge ? c.badge.replace(/ pontos$/, '') : `+${formatPoints(c.points)}`} <span className="text-base font-bold">pts</span>
                  </span>
                  <span className="mt-1.5 line-clamp-2 block text-sm font-semibold leading-snug text-white/95">{c.title}</span>
                </span>
                <span className="relative flex items-center gap-2">
                  <span className="rounded-lg bg-white p-0.5"><PlaceAvatar name={c.placeName} src={c.logoUrl} size={24} /></span>
                  <span className="truncate text-xs font-semibold text-white/95">{c.placeName}</span>
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
            className="w-full max-w-md animate-fade-in rounded-t-3xl bg-white p-5 shadow-2xl md:rounded-3xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <PlaceAvatar name={open.placeName} src={open.logoUrl} size={52} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{LOOK[open.kind].label} de</p>
                <p className="truncate text-lg font-extrabold text-primary">{open.placeName}</p>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="glass-button-ghost btn-sm !px-3" aria-label="Fechar">✕</button>
            </div>

            <div className="mb-4 rounded-2xl p-4 text-white" style={{ background: LOOK[open.kind].bg }}>
              <p className="text-3xl font-extrabold leading-none">{open.badge ?? `+${formatPoints(open.points)} pontos`}</p>
              <p id="campanha-titulo" className="mt-1.5 text-sm font-semibold">{open.title}</p>
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
