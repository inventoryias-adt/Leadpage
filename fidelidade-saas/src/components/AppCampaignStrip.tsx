import Link from 'next/link';
import { campaignBadge, campaignWhen, type AppCampaignLike } from '@/lib/app-campaigns';
import { Carousel } from './Carousel';
import { Icon } from './Icons';

export type StripCampaign = AppCampaignLike & { places: number };

// Cores sóbrias da marca, uma por cartão, para a fila não ficar monótona.
const TONES = [
  'from-[#1A3FA3] to-[#2150C9] text-white',
  'from-[#0F5C4D] to-[#17806B] text-white',
  'from-[#5B2A86] to-[#7A3FB0] text-white',
  'from-[#9A3412] to-[#C2410C] text-white',
];

/** Carrossel de campanhas do app (as que os estabelecimentos adotam). Tocar abre a lista de quem participa. */
export function AppCampaignStrip({ campaigns }: { campaigns: StripCampaign[] }) {
  if (campaigns.length === 0) return null;
  return (
    <section aria-labelledby="campanhas-app" className="space-y-3">
      <h2 id="campanhas-app" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campanhas do app</h2>
      <Carousel label="Campanhas do app">
        {campaigns.map((c, i) => (
          <li key={c.id} className="w-[17.5rem] shrink-0 snap-start">
            <Link
              href={`/campanhas/${c.id}`}
              className={`card-link flex h-full min-h-[10.5rem] flex-col justify-between gap-3 rounded-[22px] bg-gradient-to-br p-4 ${TONES[i % TONES.length]}`}
              aria-label={`${c.title}: ${campaignBadge(c)}. ${c.places} ${c.places === 1 ? 'lugar participa' : 'lugares participam'}. Toque para ver quais`}
            >
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                <Icon name="spark" size={13} /> Campanha do app
              </span>
              <span>
                <span className="block text-3xl font-bold leading-none">{campaignBadge(c)}</span>
                <span className="mt-1.5 line-clamp-2 block text-sm font-semibold leading-snug">{c.title}</span>
                <span className="mt-0.5 line-clamp-1 block text-xs opacity-85">{campaignWhen(c)}</span>
              </span>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary">
                {c.places} {c.places === 1 ? 'lugar participa' : 'lugares participam'} <Icon name="chevron" size={14} />
              </span>
            </Link>
          </li>
        ))}
      </Carousel>
    </section>
  );
}
