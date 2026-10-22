import { FIRST_MONTH_PRICE, FIRST_MONTH_PRICE_CENTS } from './plan';

/** Quanto tirar da primeira fatura para ela sair por FIRST_MONTH_PRICE_CENTS. Zero quando o preço do plano já é igual ou menor. */
export function firstMonthDiscountCents(planUnitAmount: number | null | undefined) {
  if (!planUnitAmount || planUnitAmount <= FIRST_MONTH_PRICE_CENTS) return 0;
  return planUnitAmount - FIRST_MONTH_PRICE_CENTS;
}

/** Parte do cliente do Stripe que usamos aqui (facilita testar sem chamar a API). */
export type CouponApi = {
  retrieve(id: string): Promise<unknown>;
  create(params: { id: string; name: string; amount_off: number; currency: string; duration: 'once' }): Promise<unknown>;
};

/**
 * Cupom de uso único por assinatura ("duration: once"): vale só na primeira fatura. O id carrega o valor do desconto,
 * então um cupom existente nunca fica com valor errado se o preço do plano mudar. Cria na primeira vez e reaproveita depois.
 */
export async function ensureFirstMonthCoupon(coupons: CouponApi, discountCents: number) {
  const id = `primeiro-mes-${FIRST_MONTH_PRICE_CENTS}-desc-${discountCents}`;
  try {
    await coupons.retrieve(id);
    return id;
  } catch (e) {
    if ((e as { code?: string })?.code !== 'resource_missing') throw e;
  }
  try {
    await coupons.create({ id, name: `Primeiro mês ${FIRST_MONTH_PRICE}`, amount_off: discountCents, currency: 'brl', duration: 'once' });
  } catch (e) {
    // duas pessoas pagando ao mesmo tempo: quem perdeu a corrida só usa o cupom que o outro criou
    if ((e as { code?: string })?.code !== 'resource_already_exists') throw e;
  }
  return id;
}
