/** Localização escolhida pelo cliente para ver os lugares por perto: endereços salvos, GPS ou ponto marcado no mapa. */

export const ADDRESS_LABELS = ['CASA', 'TRABALHO', 'OUTRO'] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];
export const ADDRESS_LABEL_TEXT: Record<AddressLabel, string> = { CASA: 'Casa', TRABALHO: 'Trabalho', OUTRO: 'Outro' };
export const MAX_SAVED_ADDRESSES = 6;

/** Caixa que contém o Brasil (com folga): descarta coordenadas absurdas vindas do navegador. */
export const inBrazil = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= -34.5 && lat <= 5.5 && lng >= -74.5 && lng <= -32;

/** Centro do mapa quando ainda não há nenhuma pista de onde o cliente está (centro de São Paulo). */
export const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333 };

export type Chosen = { kind: 'gps' | 'map' | 'saved'; lat: number; lng: number; title: string; sub?: string; id?: string };

export const CHOSEN_KEY = 'fz_loc_v1';

/** Lê com segurança o que foi guardado no aparelho (pode estar vazio, velho ou adulterado). */
export function parseChosen(raw: string | null): Chosen | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<Chosen>;
    if (!j || (j.kind !== 'gps' && j.kind !== 'map' && j.kind !== 'saved')) return null;
    if (typeof j.lat !== 'number' || typeof j.lng !== 'number' || !inBrazil(j.lat, j.lng)) return null;
    const title = typeof j.title === 'string' ? j.title.slice(0, 80) : '';
    if (!title) return null;
    return { kind: j.kind, lat: j.lat, lng: j.lng, title, sub: typeof j.sub === 'string' ? j.sub.slice(0, 120) : undefined, id: typeof j.id === 'string' ? j.id : undefined };
  } catch {
    return null;
  }
}

export type Guessed = { street: string; district: string; city: string; state: string; cep: string };

type NominatimAddress = Record<string, string | undefined>;

/** Lê a resposta do Nominatim (geocodificação reversa) e devolve rua, bairro, cidade, UF e CEP. */
export function parseReverse(j: { address?: NominatimAddress } | null | undefined): Guessed | null {
  const a = j?.address;
  if (!a) return null;
  const iso = a['ISO3166-2-lvl4'] ?? a['ISO3166-2-lvl3'] ?? '';
  const state = /^BR-([A-Z]{2})$/.exec(iso)?.[1] ?? '';
  return {
    street: a.road ?? a.pedestrian ?? a.footway ?? a.path ?? '',
    district: a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter ?? '',
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? '',
    state,
    cep: (a.postcode ?? '').replace(/\D/g, '').slice(0, 8),
  };
}

/** "Rua Ernesta Pelosini · Nova Petrópolis" */
export const placeLine = (g: Pick<Guessed, 'street' | 'district' | 'city'>) => [g.street || g.city, g.street ? g.district || g.city : ''].filter(Boolean).join(' · ');

/** Título e linha de apoio de um endereço salvo para mostrar na lista e no topo da vitrine. */
export function savedText(a: { label: string; street: string; number: string; district?: string | null; city: string }): { title: string; sub: string } {
  const title = ADDRESS_LABEL_TEXT[a.label as AddressLabel] ?? 'Endereço';
  return { title, sub: `${a.street}, ${a.number}${a.district ? ` · ${a.district}` : `, ${a.city}`}` };
}
