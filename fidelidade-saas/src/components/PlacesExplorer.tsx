'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { SavedAddress } from '@/app/actions/location';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { formatBRL, formatPoints } from '@/lib/points';
import type { CampaignItem } from '@/lib/campaigns';
import { CampaignCards } from './CampaignCards';
import { Carousel } from './Carousel';
import { CategoryArt } from './CategoryArt';
import { Icon } from './Icons';
import { Illustration } from './Illustrations';
import { LocationBar } from './LocationBar';
import { Reveal } from './Reveal';
import { TodayDeals, type Deal } from './TodayDeals';
import { RatingBadge } from './Stars';
import { PlaceAvatar, RewardImage } from './Visual';
import { compareByRating, type RatingSummary } from '@/lib/reviews';

export type PlaceUnit = { id: string; name: string; address: string | null; lat: number | null; lng: number | null; openNow: boolean | null };

export type PlaceOffer = { itemId: string; name: string; priceCents: number; promoCents: number; imageUrl: string | null; endsText: string | null; stock: number | null; stockTotal: number | null };

export type PlaceCard = {
  id: string;
  name: string;
  category: string | null;
  categoryLabel: string | null;
  logoUrl: string | null;
  pointsPerReal: number;
  cashbackPct: number | null; // quanto do gasto volta em pontos (%)
  hasGoogle: boolean;
  hasInstagram: boolean;
  hasRewards: boolean;
  offer: PlaceOffer | null;
  deals: PlaceOffer[]; // todo produto com promoção que ainda vale (alimenta "Promoções de hoje")
  balance: number | null;
  minReward: number | null;
  challenges: number;
  campaigns: CampaignItem[];
  units: PlaceUnit[];
  rating: RatingSummary | null;
  birthdayPerk: string | null; // só vem preenchido no aniversário do cliente ("Sobremesa grátis · grátis para o aniversariante")
};

type Filter = 'all' | 'saldo' | 'aberto' | 'desafios' | 'promo' | 'nota' | 'aniversario';
type Pos = { lat: number; lng: number };

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'saldo', label: 'Onde tenho pontos' },
  { id: 'aberto', label: 'Abertos agora' },
  { id: 'desafios', label: 'Com desafios' },
  { id: 'promo', label: 'Em promoção' },
  { id: 'nota', label: 'Mais bem avaliados' },
  { id: 'aniversario', label: '🎂 Presente de aniversário' },
];

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Vitrine de lugares: busca, filtros e ordenação por distância usando a localização do aparelho. */
export function PlacesExplorer({ places, categories, loggedIn, savedAddresses, birthdayToday = false, initialFilter }: { places: PlaceCard[]; categories: { value: string; label: string; hint?: string }[]; loggedIn: boolean; savedAddresses: SavedAddress[]; birthdayToday?: boolean; initialFilter?: Filter }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(initialFilter ?? 'all');
  const [category, setCategory] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSearchOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden'; // a página de trás não rola nem "vaza" para o lado
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!allOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAllOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allOpen]);

  const list = useMemo(() => {
    const q = norm(query.trim());
    const rows = places
      .map((p) => {
        // Unidade em destaque: a mais perto de você (se a localização estiver ligada) ou a primeira.
        let unit = p.units[0];
        let meters: number | null = null;
        if (pos) {
          for (const u of p.units) {
            if (u.lat == null || u.lng == null) continue;
            const d = distanceMeters(pos, { lat: u.lat, lng: u.lng });
            if (meters == null || d < meters) {
              meters = d;
              unit = u;
            }
          }
        }
        return { ...p, unit, meters, openAny: p.units.some((u) => u.openNow === true) };
      })
      .filter((p) => {
        if (q && !norm(`${p.name} ${p.categoryLabel ?? ''} ${p.units.map((u) => `${u.name} ${u.address ?? ''}`).join(' ')}`).includes(q)) return false;
        if (category && p.category !== category) return false;
        if (filter === 'saldo') return (p.balance ?? 0) > 0;
        if (filter === 'aberto') return p.openAny;
        if (filter === 'desafios') return p.challenges > 0;
        if (filter === 'aniversario') return p.birthdayPerk != null;
        if (filter === 'promo') return p.campaigns.some((c) => c.kind === 'promocao') || p.deals.length > 0;
        return true;
      });
    rows.sort((a, b) => {
      if (filter === 'nota') {
        const byRating = compareByRating(a.rating ?? { count: 0, avg: null, ranked: false }, b.rating ?? { count: 0, avg: null, ranked: false });
        if (byRating) return byRating;
      }
      if (a.meters != null && b.meters != null) return a.meters - b.meters;
      if (a.meters != null) return -1;
      if (b.meters != null) return 1;
      return (b.balance ?? 0) - (a.balance ?? 0) || a.name.localeCompare(b.name, 'pt-BR');
    });
    return rows;
  }, [places, query, filter, category, pos]);

  return (
    <div className="space-y-3">
      <LocationBar saved={savedAddresses} loggedIn={loggedIn} onChange={(c) => setPos(c ? { lat: c.lat, lng: c.lng } : null)} />
      <Reveal from="left" className="relative">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
          className={`flex w-full items-center gap-2.5 !rounded-full border border-slate-200 !bg-white py-2 pl-4 text-left text-sm !shadow-none ${query ? 'pr-12' : 'pr-4'}`}
        >
          <Icon name="search" size={16} className="shrink-0 text-slate-400" />
          <span className={`min-w-0 flex-1 truncate ${query ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{query || 'Buscar lugar ou categoria'}</span>
        </button>
        {query && (
          <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')} className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center !rounded-full !bg-slate-100 text-xs font-bold text-slate-600 !shadow-none hover:!bg-slate-200">✕</button>
        )}
      </Reveal>

      {/* Filtros */}
      <Reveal from="right">
      <Carousel label="Filtros">
        {FILTERS.filter((f) => (loggedIn || f.id !== 'saldo') && (birthdayToday || f.id !== 'aniversario')).map((f) => (
          <li key={f.id} className="shrink-0">
            <button
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`!w-auto !rounded-full !px-3 !py-1 !text-[13px] ${filter === f.id ? 'glass-button' : 'glass-button-ghost'}`}
            >
              {f.label}
            </button>
          </li>
        ))}
      </Carousel>
      </Reveal>

      {/* Categorias em carrossel. "Todos" abre a lista completa. */}
      <Reveal from="bottom">
      <Carousel label="Categorias">
        <li className="shrink-0 snap-start">
          <button type="button" onClick={() => setAllOpen(true)} aria-haspopup="dialog" className="group flex w-14 flex-col items-center gap-1 !bg-transparent !p-0 !shadow-none">
            <span className="rounded-lg p-0.5 transition-colors group-hover:bg-slate-200">
              <CategoryArt name="todos" size={42} />
            </span>
            <span className="text-center text-[10.5px] font-semibold leading-tight text-slate-700">Todos</span>
          </button>
        </li>
        {categories.map((c) => {
          const on = category === c.value;
          return (
            <li key={c.value} className="shrink-0 snap-start">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setCategory(on ? null : c.value)}
                className="group flex w-14 flex-col items-center gap-1 !bg-transparent !p-0 !shadow-none"
              >
                <span className={`rounded-lg p-0.5 transition-colors ${on ? 'bg-electric-500' : 'group-hover:bg-slate-200'}`}>
                  <CategoryArt name={c.value} size={42} />
                </span>
                <span className={`text-center text-[10.5px] font-medium leading-tight ${on ? 'text-electric-600' : 'text-slate-700'}`}>{c.label}</span>
              </button>
            </li>
          );
        })}
      </Carousel>
      </Reveal>

      {category && (
        <button type="button" onClick={() => setCategory(null)} className="glass-button-ghost btn-sm !rounded-full" aria-label="Limpar categoria">
          Categoria: {categories.find((c) => c.value === category)?.label} ✕
        </button>
      )}

      {category === 'outros' && (
        <div className="glass-inset space-y-2 p-3">
          <label className="glass-label" htmlFor="outros-q">O que você procura em “Outros”?</label>
          <input id="outros-q" value={query} onChange={(e) => setQuery(e.target.value)} className="glass-input" placeholder="Ex.: doceria, chaveiro, ateliê" maxLength={60} />
          <p className="text-xs text-slate-500">Mostra os lugares que descreveram o que são (ex.: “Outros · Doceria”).</p>
        </div>
      )}

      <TodayDeals
        deals={list.flatMap((p): Deal[] =>
          p.deals.map((d) => ({
            placeId: p.id,
            placeName: p.name,
            logoUrl: p.logoUrl,
            unitId: p.units.length > 1 ? p.unit.id : null,
            distance: p.meters != null ? formatDistance(p.meters) : null,
            ...d,
          })),
        )}
      />

      <CampaignCards
        loggedIn={loggedIn}
        items={list.flatMap((p) => p.campaigns.map((c) => ({ ...c, placeId: p.id, placeName: p.name, logoUrl: p.logoUrl })))}
      />

      {allOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:items-center md:p-6" onClick={() => setAllOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="todas-categorias"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-2xl animate-fade-in overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:rounded-3xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="todas-categorias" className="text-lg font-extrabold text-primary">Todas as categorias</h2>
              <button type="button" onClick={() => setAllOpen(false)} className="glass-button-ghost btn-sm !px-3" aria-label="Fechar">✕</button>
            </div>
            <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5 md:grid-cols-6">
              {categories.map((c) => {
                const on = category === c.value;
                return (
                  <li key={c.value} className="flex justify-center">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setCategory(on ? null : c.value);
                        setAllOpen(false);
                      }}
                      title={c.hint}
                      className="group flex w-[4.5rem] flex-col items-center gap-1.5 !bg-transparent !p-0 !shadow-none"
                    >
                      <span className={`rounded-xl p-0.5 transition-colors ${on ? 'bg-electric-500' : 'group-hover:bg-slate-200'}`}>
                        <CategoryArt name={c.value} size={60} />
                      </span>
                      <span className={`text-center text-[11px] font-medium leading-tight ${on ? 'text-electric-600' : 'text-slate-700'}`}>{c.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" className="glass-button-ghost btn-sm" onClick={() => { setCategory(null); setAllOpen(false); }}>Mostrar todos os lugares</button>
              <button type="button" className="glass-button-ghost btn-sm" onClick={() => setAllOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-800">{pos ? 'Lugares por perto' : 'Todos os lugares'}</h2>
        <span className="text-xs text-slate-500">{list.length} {list.length === 1 ? 'lugar' : 'lugares'}</span>
      </div>

      {list.length === 0 ? (
        <div className="glass-panel flex flex-col items-center p-6 text-center">
          <Illustration variant="empty" size={150} />
          <p className="font-bold text-slate-800">
            {filter === 'saldo' ? 'Nenhum lugar com saldo ainda' : category ? `Nenhum lugar de ${categories.find((c) => c.value === category)?.label ?? 'esta categoria'} por enquanto` : 'Nada encontrado'}
          </p>
          <p className="mt-1 max-w-xs text-sm text-slate-600">
            {filter === 'saldo'
              ? 'Assim que você ganhar pontos em algum lugar, ele aparece aqui.'
              : 'Tente outra busca ou limpe os filtros.'}
          </p>
          {(filter !== 'all' || category || query) && (
            <button type="button" className="glass-button-ghost btn-sm mt-4" onClick={() => { setFilter('all'); setCategory(null); setQuery(''); }}>
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
          {list.flatMap((p, i) => [
            <Reveal as="li" key={p.id} from={i % 2 === 0 ? 'left' : 'right'} delay={(i % 4) * 50}>
              <PlaceRow p={p} />
            </Reveal>,
            ...(p.offer ? [<Reveal as="li" key={`${p.id}-oferta`} from="bottom" className="md:col-span-2 lg:col-span-3"><OfferCard p={p} offer={p.offer} /></Reveal>] : []),
          ])}
        </ul>
      )}

      {searchOpen && (
        <div role="dialog" aria-modal="true" aria-label="Buscar lugares" className="fixed inset-0 z-50 flex justify-center overflow-hidden bg-white md:items-center md:bg-slate-900/50 md:p-6">
          <div className="flex h-full w-full min-w-0 max-w-lg flex-col overflow-hidden bg-white md:h-[min(46rem,92vh)] md:rounded-[28px] md:shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Voltar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                <Icon name="back" size={20} />
              </button>
              <div className="relative min-w-0 flex-1">
                <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setSearchOpen(false)}
                  placeholder="Buscar lugar ou categoria"
                  aria-label="Buscar lugares"
                  enterKeyHint="search"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  className="glass-input !rounded-full !pl-11"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              {query.trim() === '' ? (
                <>
                  <p className="mb-1 mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">Explorar por categoria</p>
                  <ul className="divide-y divide-slate-100">
                    {categories.map((c) => (
                      <li key={c.value}>
                        <button
                          type="button"
                          onClick={() => { setCategory(c.value); setQuery(''); setSearchOpen(false); }}
                          className="flex w-full items-center gap-3 !rounded-none !bg-transparent py-2.5 text-left !shadow-none hover:!bg-slate-50"
                        >
                          <CategoryArt name={c.value} size={40} />
                          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-800">{c.label}</span>
                          <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : list.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Nada encontrado para “{query.trim()}”.</p>
              ) : (
                <>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{list.length} {list.length === 1 ? 'resultado' : 'resultados'}</p>
                  <ul className="space-y-3">
                    {list.slice(0, 30).map((p) => (
                      <li key={p.id}><PlaceRow p={p} /></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="border-t border-slate-100 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button type="button" onClick={() => setSearchOpen(false)} className="glass-button !rounded-full">{query.trim() ? 'Ver na lista' : 'Fechar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Row = PlaceCard & { unit: PlaceUnit; meters: number | null };

/** Cartão de um lugar na lista: distância, aberto/fechado e quantas campanhas rolam lá. */
function PlaceRow({ p }: { p: Row }) {
  return (
    <Link href={p.units.length > 1 ? `/lugar/${p.id}?unidade=${p.unit.id}` : `/lugar/${p.id}`} className="glass-panel-sm card-link flex items-center gap-3 !rounded-2xl p-3">
      <PlaceAvatar name={p.name} src={p.logoUrl} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[15px] font-bold text-slate-900">{p.name}</p>
          {p.meters != null && <span className="shrink-0 text-xs font-semibold text-electric-600">{formatDistance(p.meters)}</span>}
        </div>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
          <RatingBadge summary={p.rating ?? undefined} className="shrink-0 !text-xs" />
          <span className="truncate">{[p.categoryLabel, p.units.length > 1 ? p.unit.name : null, p.unit.address].filter(Boolean).join(' · ')}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {(p.hasGoogle || p.hasInstagram || p.hasRewards || p.challenges > 0) && (
          <ul className="flex items-center gap-1 text-electric-600" aria-label="O que este lugar oferece" data-testid="offers-icons">
          {p.hasGoogle && <li title="Pontos por avaliar no Google" aria-label="Avaliação no Google" className="flex h-5 w-5 items-center justify-center rounded-md bg-[#EAF0FF]"><Icon name="star" size={12} /></li>}
          {p.hasInstagram && <li title="Pontos por marcar no Instagram" aria-label="Instagram" className="flex h-5 w-5 items-center justify-center rounded-md bg-[#EAF0FF]"><Icon name="camera" size={12} /></li>}
          {p.hasRewards && <li title="Tem prêmios para trocar" aria-label="Prêmios" className="flex h-5 w-5 items-center justify-center rounded-md bg-[#EAF0FF]"><Icon name="gift" size={12} /></li>}
          {p.challenges > 0 && <li title="Tem desafios" aria-label="Desafios" className="flex h-5 w-5 items-center justify-center rounded-md bg-[#EAF0FF]"><Icon name="trophy" size={12} /></li>}
          </ul>
          )}
          {p.unit.openNow != null && (
            <span className={`rounded-full px-2 py-px text-[10.5px] font-semibold ${p.unit.openNow ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {p.unit.openNow ? 'Aberto agora' : 'Fechado agora'}
            </span>
          )}
          {p.birthdayPerk && (
            <span className="rounded-full bg-amber-50 px-2 py-px text-[10.5px] font-semibold text-amber-700" data-testid="birthday-chip" title={p.birthdayPerk}>🎂 Presente de aniversário</span>
          )}
          {p.balance != null && p.balance > 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-px text-[10.5px] font-semibold text-emerald-700">Você tem {formatPoints(p.balance)} pts</span>
          )}
          {p.units.length > 1 && <span className="rounded-full bg-slate-100 px-2 py-px text-[10.5px] font-medium text-slate-700">{p.units.length} unidades</span>}
          {p.cashbackPct ? (
            <span className="chip-lima !px-2 !py-px !text-[10.5px]" data-testid="cashback-chip">{String(p.cashbackPct).replace('.', ',')}% de volta</span>
          ) : (
            <span className="glass-chip !px-2 !py-px !text-[10.5px]">{p.pointsPerReal} pts por R$ 1</span>
          )}
        </div>
      </div>
      <Icon name="chevron" size={16} className="text-slate-300" />
    </Link>
  );
}

/** Cartão de oferta (preço promocional com prazo e estoque) logo abaixo do lugar. O anel mostra quanto do estoque ainda resta. */
function OfferCard({ p, offer }: { p: Row; offer: PlaceOffer }) {
  const pct = offer.stock != null && offer.stockTotal ? Math.max(0, Math.min(1, offer.stock / offer.stockTotal)) : null;
  const R = 46;
  const C = 2 * Math.PI * R;
  const href = `/lugar/${p.id}/pedido?item=${offer.itemId}${p.units.length > 1 ? `&unidade=${p.unit.id}` : ''}`;
  return (
    <section aria-label={`Oferta de ${p.name}`} data-testid="offer-card">
      <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{p.name} · oferta</p>
      <div className="flex items-center justify-between gap-3 rounded-[28px] bg-[#0F1F3D] p-5 text-white">
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold leading-tight tracking-tight">{offer.name}</h3>
          <p className="mt-1.5">
            <span className="text-2xl font-extrabold text-lima">{formatBRL(offer.promoCents)}</span>
            <span className="ml-2 text-sm font-medium text-white/60 line-through">{formatBRL(offer.priceCents)}</span>
          </p>
          {offer.endsText && <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80"><Icon name="clock" size={15} /> {offer.endsText}</p>}
          <Link href={href} className="glass-button-lime btn-sm mt-3 !w-auto px-8" data-testid="offer-order">Pedir</Link>
        </div>
        <div className="relative shrink-0">
          <div className="relative h-28 w-28">
            {pct != null && (
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="5" />
                <circle cx="50" cy="50" r={R} fill="none" stroke="#C6F432" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} />
              </svg>
            )}
            <div className="absolute inset-[7px] overflow-hidden rounded-full bg-white">
              <RewardImage src={offer.imageUrl} name={offer.name} className="h-full w-full" />
            </div>
          </div>
          {offer.stock != null && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-800 shadow" data-testid="offer-stock">restam {offer.stock}</span>}
        </div>
      </div>
    </section>
  );
}
