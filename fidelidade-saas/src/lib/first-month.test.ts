import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureFirstMonthCoupon, firstMonthDiscountCents, type CouponApi } from './first-month';
import { PLAN_PRICE_CENTS, firstMonthEligible } from './plan';

test('desconto da primeira fatura: R$ 69,90 vira R$ 39,90', () => {
  assert.equal(PLAN_PRICE_CENTS - firstMonthDiscountCents(PLAN_PRICE_CENTS), 3990);
  assert.equal(firstMonthDiscountCents(6990), 3000);
});

test('sem desconto quando o plano já custa o valor da oferta ou menos, ou o preço é desconhecido', () => {
  assert.equal(firstMonthDiscountCents(3990), 0);
  assert.equal(firstMonthDiscountCents(2990), 0);
  assert.equal(firstMonthDiscountCents(null), 0);
  assert.equal(firstMonthDiscountCents(undefined), 0);
});

test('só quem nunca pagou tem a oferta', () => {
  assert.equal(firstMonthEligible({ subscriptionStatus: 'PENDING', paymentCustomerId: null }), true);
  assert.equal(firstMonthEligible({ subscriptionStatus: 'PENDING', paymentCustomerId: 'cus_1' }), false);
  assert.equal(firstMonthEligible({ subscriptionStatus: 'CANCELED', paymentCustomerId: 'cus_1' }), false);
  assert.equal(firstMonthEligible({ subscriptionStatus: 'PAST_DUE', paymentCustomerId: null }), false);
  assert.equal(firstMonthEligible({ subscriptionStatus: 'ACTIVE', paymentCustomerId: 'cus_1' }), false);
});

const missing = Object.assign(new Error('No such coupon'), { code: 'resource_missing' });

test('cria o cupom de uso único na primeira vez e reaproveita nas seguintes', async () => {
  const created: unknown[] = [];
  let exists = false;
  const api: CouponApi = {
    retrieve: async () => { if (!exists) throw missing; return {}; },
    create: async (p) => { created.push(p); exists = true; return {}; },
  };
  const a = await ensureFirstMonthCoupon(api, 3000);
  const b = await ensureFirstMonthCoupon(api, 3000);
  assert.equal(a, b);
  assert.equal(created.length, 1);
  assert.deepEqual(created[0], { id: 'primeiro-mes-3990-desc-3000', name: 'Primeiro mês R$ 39,90', amount_off: 3000, currency: 'brl', duration: 'once' });
});

test('o id muda com o valor do desconto (preço do plano diferente não reaproveita cupom errado)', async () => {
  const api: CouponApi = { retrieve: async () => ({}), create: async () => ({}) };
  assert.notEqual(await ensureFirstMonthCoupon(api, 3000), await ensureFirstMonthCoupon(api, 4000));
});

test('corrida entre dois pagamentos: se o cupom já foi criado por outro, segue com ele', async () => {
  const api: CouponApi = {
    retrieve: async () => { throw missing; },
    create: async () => { throw Object.assign(new Error('exists'), { code: 'resource_already_exists' }); },
  };
  assert.equal(await ensureFirstMonthCoupon(api, 3000), 'primeiro-mes-3990-desc-3000');
});

test('erros de verdade do Stripe não são engolidos', async () => {
  const boom = Object.assign(new Error('chave inválida'), { code: 'api_key_expired' });
  await assert.rejects(ensureFirstMonthCoupon({ retrieve: async () => { throw boom; }, create: async () => ({}) }, 3000), /chave inválida/);
  await assert.rejects(ensureFirstMonthCoupon({ retrieve: async () => { throw missing; }, create: async () => { throw boom; } }, 3000), /chave inválida/);
});
