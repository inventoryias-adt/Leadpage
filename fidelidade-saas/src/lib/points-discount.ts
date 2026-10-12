/**
 * Pontos como desconto num serviço. Tudo em centavos e pontos inteiros.
 *  - `rate`: quantos pontos valem R$ 1,00 de desconto (por estabelecimento; padrão 100, ou seja, 1 ponto = 1 centavo).
 *  - `maxPct`: até quantos % do preço o serviço aceita pagar com pontos (0 = não aceita).
 */
export type DiscountRule = { priceCents: number; maxPct: number; rate: number; balance: number };

/** Desconto em centavos que `points` pontos dão (arredonda para baixo). */
export const discountFor = (points: number, rate: number) => (rate > 0 ? Math.floor((points * 100) / rate) : 0);

/** Pontos necessários para um desconto em centavos (arredonda para cima). */
export const pointsFor = (discountCents: number, rate: number) => Math.ceil((discountCents * rate) / 100);

/** O máximo que o cliente pode usar: limitado pelo % do serviço e pelo saldo. */
export function maxDiscount(rule: DiscountRule): { maxPoints: number; maxDiscountCents: number } {
  const { priceCents, maxPct, rate, balance } = rule;
  if (priceCents <= 0 || maxPct <= 0 || rate <= 0 || balance <= 0) return { maxPoints: 0, maxDiscountCents: 0 };
  const capCents = Math.floor((priceCents * Math.min(maxPct, 100)) / 100);
  const maxPoints = Math.min(Math.max(0, Math.floor(balance)), pointsFor(capCents, rate));
  return { maxPoints, maxDiscountCents: Math.min(capCents, discountFor(maxPoints, rate)) };
}

/** Confere o pedido do cliente: devolve os pontos e o desconto, ou o motivo de recusar. Nunca confia no que veio do navegador. */
export function applyPoints(requested: number, rule: DiscountRule): { points: number; discountCents: number } | { error: string } {
  if (!Number.isFinite(requested) || requested < 0 || !Number.isInteger(requested)) return { error: 'Quantidade de pontos inválida.' };
  if (requested === 0) return { points: 0, discountCents: 0 };
  const { maxPoints, maxDiscountCents } = maxDiscount(rule);
  if (maxPoints <= 0) return { error: 'Este serviço não aceita pontos agora ou o seu saldo é insuficiente.' };
  if (requested > maxPoints) return { error: 'Você pediu mais pontos do que pode usar neste serviço.' };
  return { points: requested, discountCents: Math.min(maxDiscountCents, discountFor(requested, rule.rate)) };
}

/** Quantos % do valor gasto voltam em pontos (para o dono entender a regra): ganha `earn` pontos por R$ 1,00 e `rate` pontos valem R$ 1,00. */
export const cashbackPct = (earnPointsPerReal: number, rate: number) => (rate > 0 ? Math.round((earnPointsPerReal / rate) * 1000) / 10 : 0);
