/**
 * Pontos compartilhados entre lugares: conversão pelo valor.
 * Um ponto vale 1/pointsPerReal reais de consumo naquele lugar (quem dá 10 pontos por real: 1 ponto = R$ 0,10;
 * quem dá 5: R$ 0,20). Ao completar um resgate no lugar B com pontos do lugar A, 100 pontos de A (R$ 10,00 de consumo)
 * valem 100 × (ppr de B ÷ ppr de A) pontos de B. Sem acerto financeiro entre os lugares.
 */

export type ShareSource = { walletId: string; restaurantId: string; name: string; balance: number; pointsPerReal: number };
export type SharePart = { walletId: string; restaurantId: string; name: string; take: number; gives: number };
export type SharePlan = { ok: boolean; parts: SharePart[]; covered: number };

/** Quantos pontos do destino correspondem a `points` da origem (arredonda para baixo). */
export const toDestPoints = (points: number, srcPpr: number, destPpr: number) => Math.floor((points * destPpr) / srcPpr);

/** Quantos pontos da origem são necessários para render `destPoints` no destino (arredonda para cima). */
export const srcPointsFor = (destPoints: number, srcPpr: number, destPpr: number) => Math.ceil((destPoints * srcPpr) / destPpr);

/** Total que as carteiras compartilháveis rendem no destino. */
export const sharedTotal = (sources: ShareSource[], destPpr: number) => sources.reduce((n, s) => n + toDestPoints(s.balance, s.pointsPerReal, destPpr), 0);

/**
 * Monta quanto tirar de cada carteira de origem para cobrir `shortfall` pontos do destino.
 * Usa primeiro as que rendem mais (menos carteiras mexidas) e, na última, só o necessário.
 */
export function planShared(shortfall: number, sources: ShareSource[], destPpr: number): SharePlan {
  const parts: SharePart[] = [];
  let remaining = shortfall;
  const ranked = sources
    .filter((s) => s.balance > 0 && s.pointsPerReal > 0)
    .map((s) => ({ s, value: toDestPoints(s.balance, s.pointsPerReal, destPpr) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value || a.s.walletId.localeCompare(b.s.walletId));
  for (const { s, value } of ranked) {
    if (remaining <= 0) break;
    if (value >= remaining) {
      const take = srcPointsFor(remaining, s.pointsPerReal, destPpr);
      parts.push({ walletId: s.walletId, restaurantId: s.restaurantId, name: s.name, take, gives: toDestPoints(take, s.pointsPerReal, destPpr) });
      remaining = 0;
    } else {
      parts.push({ walletId: s.walletId, restaurantId: s.restaurantId, name: s.name, take: s.balance, gives: value });
      remaining -= value;
    }
  }
  const covered = parts.reduce((n, p) => n + p.gives, 0);
  return { ok: remaining <= 0, parts, covered };
}
