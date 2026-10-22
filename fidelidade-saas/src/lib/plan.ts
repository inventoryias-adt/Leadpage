/** Preço do plano do estabelecimento, num só lugar (landing, pagamento, termos). O preço cobrado é o do Stripe (STRIPE_PRICE_ID). */
export const PLAN_PRICE_CENTS = 6990;
export const PLAN_PRICE = 'R$ 69,90';
export const PLAN_PRICE_INT = 'R$ 69';
export const PLAN_PRICE_DEC = ',90';

/** Oferta de entrada: o primeiro mês sai por este valor e a partir do segundo vale o preço do plano. */
export const FIRST_MONTH_PRICE_CENTS = 3990;
export const FIRST_MONTH_PRICE = 'R$ 39,90';
export const FIRST_MONTH_PRICE_INT = 'R$ 39';
export const FIRST_MONTH_PRICE_DEC = ',90';

/** A oferta vale só para quem nunca pagou: conta nova, ainda sem cliente no Stripe. Quem cancelou ou atrasou paga o preço cheio. */
export const firstMonthEligible = (r: { subscriptionStatus: string; paymentCustomerId: string | null }) =>
  r.subscriptionStatus === 'PENDING' && !r.paymentCustomerId;
