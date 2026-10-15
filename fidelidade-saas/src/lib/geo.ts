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
 * Raio (m) para valer o check-in: o cliente precisa estar dentro do estabelecimento (a partir do ponto marcado na
 * unidade). O padrão é curto de propósito, para não valer quem só passa na frente; por isso o ponto da unidade no
 * mapa precisa ser exato. Cada estabelecimento escolhe o seu entre as opções abaixo (Regras → Check-in).
 * O app NÃO mostra esse número nem a distância ao cliente (evita "chegar até a borda do raio").
 */
export const DEFAULT_CHECKIN_RADIUS_M = 10;
export const CHECKIN_RADIUS_OPTIONS: { value: number; label: string; hint: string }[] = [
  { value: 10, label: '10 m', hint: 'Só dentro da loja (padrão). Exige o ponto da unidade bem exato.' },
  { value: 20, label: '20 m', hint: 'Loja pequena, com GPS fraco.' },
  { value: 30, label: '30 m', hint: 'Loja pequena que aceita um pouco da calçada.' },
  { value: 50, label: '50 m', hint: 'Loja grande ou de esquina.' },
  { value: 75, label: '75 m', hint: 'Loja grande com estacionamento.' },
  { value: 100, label: '100 m', hint: 'Shopping ou quadra inteira.' },
  { value: 150, label: '150 m', hint: 'Shopping grande ou centro comercial.' },
  { value: 200, label: '200 m', hint: 'Bem flexível: aceita quem está no entorno.' },
  { value: 300, label: '300 m', hint: 'Área aberta: feira, praça, evento.' },
  { value: 400, label: '400 m', hint: 'Área aberta grande.' },
  { value: 500, label: '500 m', hint: 'O máximo. Aceita quem está a uns cinco minutos a pé.' },
];

/** Posição da escala de um raio (para o controle deslizante); se o valor não está na escala, a mais próxima abaixo. */
export function radiusIndex(radiusM: number) {
  let idx = 0;
  CHECKIN_RADIUS_OPTIONS.forEach((o, i) => { if (o.value <= radiusM) idx = i; });
  return idx;
}

/**
 * Precisão (margem de erro do GPS) que o check-in aceita: nunca menos que 50 m e, quando o dono escolhe um raio maior,
 * acompanha o raio. Assim um computador, que acha a posição pelo Wi-Fi com centenas de metros de margem, consegue num lugar de raio
 * grande; já num raio de 10 m a leitura precisa ser boa. A posição ainda precisa cair dentro do raio.
 */
export const MIN_ACCEPTED_ACCURACY_M = 50;
export const maxAcceptedAccuracyM = (radiusM: number) => Math.max(MIN_ACCEPTED_ACCURACY_M, radiusM);
