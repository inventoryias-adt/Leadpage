'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { formatPoints } from '@/lib/points';
import type { CampaignItem } from '@/lib/campaigns';
import { CampaignCards } from './CampaignCards';
import { Carousel } from './Carousel';
import { CategoryArt } from './CategoryArt';
import { Icon } from './Icons';
import { Illustration } from './Illustrations';
import { PlaceAvatar } from './Visual';

export type PlaceUnit = { id: string; name: string; address: string | null; lat: number | null; lng: number | null; openNow: boolean | null };

export type PlaceCard = {
  id: string;
  name: string;
  category: string | null;
  categoryLabel: string | null;
  logoUrl: string | null;
  pointsPerReal: number;
  balance: number | null;
  minReward: number | null;
  challenges: number;
  campaigns: CampaignItem[];
  units: PlaceUnit[];
};

type Filter = 'all' | 'saldo' | 'aberto' | 'desafios';
type Pos = { lat: number; lng: number };

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'saldo', label: 'Onde tenho pontos' },
  { id: 'aberto', label: 'Abertos agora' },
  { id: 'desafios', label: 'Com desafios' },
];

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Vitrine de lugares: busca, filtros e ordenação por distância usando a localização do aparelho. */
export function PlacesExplorer({ places, categories, loggedIn }: { places: PlaceCard[]; categories: { value: string; label: string; hint?: string }[]; loggedIn: boolean }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [geo, setGeo] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle');

  function locate() {
    if (!('geolocation' in navigator)) {
      setGeo('error');
      return;
    }
    setGeo('loading');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeo('idle');
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 120_000 },
    );
  }

  // Se o usuário já liberou a localização antes, usa direto, sem pedir de novo.
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' }).then((r) => r.state === 'granted' && locate()).catch(() => {});
  }, []);

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
        return true;
      });
    rows.sort((a, b) => {
      if (a.meters != null && b.meters != null) return a.meters - b.meters;
      if (a.meters != null) return -1;
      if (b.meters != null) return 1;
      return (b.balance ?? 0) - (a.balance ?? 0) || a.name.localeCompare(b.name, 'pt-BR');
    });
    return rows;
  }, [places, query, filter, category, pos]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar lugar ou categoria"
          aria-label="Buscar lugares"
          className="glass-input !pl-11"
        />
      </div>

      {/* Localização */}
      {pos ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <Icon name="pin" size={16} /> Mostrando do mais perto para o mais longe
        </p>
      ) : (
        <div className="glass-inset flex items-center justify-between gap-3 p-3">
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <Icon name="pin" size={18} className="mt-0.5 text-electric-600" />
            <span>
              {geo === 'denied'
                ? 'Localização bloqueada. Libere no navegador para ver o que tem perto.'
                : geo === 'error'
                  ? 'Não foi possível obter a localização. Tente de novo.'
                  : 'Ative a localização para ver os lugares mais perto de você.'}
            </span>
          </p>
          <button type="button" onClick={locate} disabled={geo === 'loading'} className="glass-button btn-sm shrink-0">
            {geo === 'loading' ? 'Buscando…' : 'Usar minha localização'}
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="chip-row" role="tablist" aria-label="Filtros">
        {FILTERS.filter((f) => loggedIn || f.id !== 'saldo').map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 !w-auto !rounded-md !px-4 !py-1.5 !text-sm ${filter === f.id ? 'glass-button' : 'glass-button-ghost'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <CampaignCards
        loggedIn={loggedIn}
        items={list.flatMap((p) => p.campaigns.map((c) => ({ ...c, placeId: p.id, placeName: p.name, logoUrl: p.logoUrl })))}
      />

      {/* Categorias em carrossel. "Todos" abre a lista completa. */}
      <Carousel label="Categorias">
        <li className="shrink-0 snap-start">
          <button type="button" onClick={() => setAllOpen(true)} aria-haspopup="dialog" className="group flex w-[4.5rem] flex-col items-center gap-1.5 !bg-transparent !p-0 !shadow-none">
            <span className="rounded-xl p-0.5 transition-colors group-hover:bg-slate-200">
              <CategoryArt name="todos" size={60} />
            </span>
            <span className="text-center text-[11px] font-semibold leading-tight text-slate-700">Todos</span>
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
      </Carousel>

      {category && (
        <button type="button" onClick={() => setCategory(null)} className="glass-button-ghost btn-sm" aria-label="Limpar categoria">
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
        <h2 className="font-bold text-slate-800">{pos ? 'Lugares por perto' : 'Todos os lugares'}</h2>
        <span className="text-sm text-slate-500">{list.length} {list.length === 1 ? 'lugar' : 'lugares'}</span>
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
          {list.map((p) => (
            <li key={p.id}>
              <Link href={p.units.length > 1 ? `/lugar/${p.id}?unidade=${p.unit.id}` : `/lugar/${p.id}`} className="glass-panel-sm card-link flex items-center gap-3.5 p-3.5">
                <PlaceAvatar name={p.name} src={p.logoUrl} size={60} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-bold text-slate-900">{p.name}</p>
                    {p.meters != null && <span className="shrink-0 text-xs font-semibold text-electric-600">{formatDistance(p.meters)}</span>}
                  </div>
                  <p className="truncate text-xs text-slate-500">{[p.categoryLabel, p.units.length > 1 ? p.unit.name : null, p.unit.address].filter(Boolean).join(' · ')}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.unit.openNow != null && (
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${p.unit.openNow ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {p.unit.openNow ? 'Aberto agora' : 'Fechado agora'}
                      </span>
                    )}
                    {p.units.length > 1 && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{p.units.length} unidades</span>
                    )}
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{p.pointsPerReal} pts por R$ 1</span>
                    {p.balance != null && p.balance > 0 && (
                      <span className="rounded-md bg-[#E8EEFB] px-2 py-0.5 text-[11px] font-medium text-electric-600">Você tem {formatPoints(p.balance)} pts</span>
                    )}
                    {p.challenges > 0 && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {p.challenges} {p.challenges === 1 ? 'desafio' : 'desafios'}
                      </span>
                    )}
                  </div>
                </div>
                <Icon name="chevron" size={18} className="text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
