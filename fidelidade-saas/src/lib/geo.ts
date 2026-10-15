/** Distância entre dois pontos da Terra (fórmula de Haversine), em metros. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "350 m", "2,1 km", "34 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

export function validCoords(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Raio (m) para valer o check-in: o cliente precisa estar dentro do estabelecimento (a partir do endereço marcado
 * na unidade). Curto de propósito, para não valer quem só passa na frente; por isso o ponto da unidade no mapa
 * precisa ser exato. O app NÃO mostra esse número nem a distância ao cliente (evita "chegar até a borda do raio").
 */
export const CHECKIN_RADIUS_M = 10;
