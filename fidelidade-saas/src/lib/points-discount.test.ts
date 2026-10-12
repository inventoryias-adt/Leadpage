import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPoints, cashbackPct, discountFor, maxDiscount, pointsFor } from './points-discount';

const rule = { priceCents: 5000, maxPct: 50, rate: 100, balance: 4000 };

test('conversão entre pontos e desconto (100 pontos = R$ 1,00)', () => {
  assert.equal(discountFor(1500, 100), 1500, '1 ponto = 1 centavo');
  assert.equal(discountFor(1599, 200), 799, 'arredonda para baixo');
  assert.equal(pointsFor(1250, 100), 1250);
  assert.equal(pointsFor(1250, 150), 1875);
  assert.equal(discountFor(10, 0), 0, 'taxa inválida não dá desconto');
});

test('máximo: o menor entre o % do serviço e o saldo', () => {
  assert.deepEqual(maxDiscount(rule), { maxPoints: 2500, maxDiscountCents: 2500 }, '50% de R$ 50,00 = R$ 25,00');
  assert.deepEqual(maxDiscount({ ...rule, balance: 800 }), { maxPoints: 800, maxDiscountCents: 800 }, 'saldo menor que o teto');
  assert.deepEqual(maxDiscount({ ...rule, maxPct: 100 }), { maxPoints: 4000, maxDiscountCents: 4000 });
  assert.deepEqual(maxDiscount({ ...rule, maxPct: 0 }), { maxPoints: 0, maxDiscountCents: 0 }, 'serviço que não aceita pontos');
  assert.deepEqual(maxDiscount({ ...rule, balance: 0 }), { maxPoints: 0, maxDiscountCents: 0 });
  assert.deepEqual(maxDiscount({ ...rule, priceCents: 0 }), { maxPoints: 0, maxDiscountCents: 0 }, 'serviço sem preço');
  assert.equal(maxDiscount({ ...rule, rate: 150 }).maxDiscountCents <= 2500, true, 'nunca passa do teto');
});

test('pedido do cliente: aceita até o máximo, recusa mais e valores inválidos', () => {
  assert.deepEqual(applyPoints(0, rule), { points: 0, discountCents: 0 });
  assert.deepEqual(applyPoints(1500, rule), { points: 1500, discountCents: 1500 });
  assert.deepEqual(applyPoints(2500, rule), { points: 2500, discountCents: 2500 });
  assert.ok('error' in applyPoints(2501, rule));
  assert.ok('error' in applyPoints(-5, rule));
  assert.ok('error' in applyPoints(10.5, rule));
  assert.ok('error' in applyPoints(Number.NaN, rule));
  assert.ok('error' in applyPoints(100, { ...rule, maxPct: 0 }), 'serviço que não aceita pontos recusa');
  assert.ok('error' in applyPoints(100, { ...rule, balance: 50 }), 'saldo insuficiente');
});

test('quanto volta em pontos (informação para o dono)', () => {
  assert.equal(cashbackPct(10, 100), 10);
  assert.equal(cashbackPct(10, 200), 5);
  assert.equal(cashbackPct(10, 0), 0);
});
