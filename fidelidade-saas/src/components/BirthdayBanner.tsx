import Link from 'next/link';
import { perkCondition } from '@/lib/birthday-perk';
import { Icon } from './Icons';

export type PerkPlace = { id: string; name: string; birthdayPerkTitle: string | null; birthdayPerkMode: string; birthdayPerkPoints: number; birthdayPerkMinCents: number };

/**
 * "Feliz aniversário": aparece só no dia do aniversário do cliente (Início e Lugares). Convida a comemorar nos lugares do clube
 * (usar os pontos, campanhas) e destaca os que têm presente para aniversariante.
 */
export function BirthdayBanner({ name, places, showList = false }: { name: string; places: PerkPlace[]; showList?: boolean }) {
  const n = places.length;
  return (
    <section aria-label="Feliz aniversário" data-testid="birthday-banner" className="relative overflow-hidden rounded-[22px] bg-[#0F1F3D] p-4 text-white shadow-[0_10px_26px_rgba(15,31,61,.22)]">
      <span aria-hidden className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-lima/25 blur-2xl" />
      <div className="relative">
        <p className="text-lg font-extrabold leading-tight">Feliz aniversário, {name}! 🎂</p>
        <p className="mt-1 text-sm text-white/80">
          {n > 0
            ? `Hoje é o seu dia: ${n} ${n === 1 ? 'lugar tem' : 'lugares têm'} um presente para você. Venha comemorar e use os seus pontos.`
            : 'Hoje é o seu dia! Aproveite para comemorar e usar os seus pontos nos lugares do clube.'}
        </p>
        {showList && n > 0 && (
          <ul className="mt-3 space-y-1.5" aria-label="Presentes de aniversário">
            {places.slice(0, 3).map((p) => (
              <li key={p.id}>
                <Link href={`/lugar/${p.id}`} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm transition-colors hover:bg-white/15">
                  <Icon name="gift" size={16} className="shrink-0 text-lima" />
                  <span className="min-w-0 flex-1 truncate"><b>{p.name}</b> · {p.birthdayPerkTitle} <span className="text-white/60">({perkCondition({ mode: p.birthdayPerkMode, points: p.birthdayPerkPoints, minCents: p.birthdayPerkMinCents })})</span></span>
                  <Icon name="chevron" size={14} className="shrink-0 text-white/50" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href={n > 0 ? '/lugares?filtro=aniversario' : '/lugares'} className="glass-button-lime btn-sm mt-3 !w-auto" data-testid="birthday-cta">
          {n > 0 ? (n > 3 && showList ? `Ver os ${n} presentes` : 'Ver presentes') : 'Ver lugares'}
        </Link>
      </div>
    </section>
  );
}
