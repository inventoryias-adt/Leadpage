import assert from 'node:assert/strict';
import test from 'node:test';
import { planShared, sharedTotal, srcPointsFor, toDestPoints, type ShareSource } from './shared-points';

const src = (walletId: string, balance: number, pointsPerReal: number): ShareSource => ({ walletId, restaurantId: `r-${walletId}`, name: walletId.toUpperCase(), balance, pointsPerReal });

test('conversão pelo valor: quem dá menos pontos por real vale mais por ponto', () => {
  assert.equal(toDestPoints(100, 10, 5), 50); // 100 pts de quem dá 10/R$ = R$ 10 → 50 pts de quem dá 5/R$
  assert.equal(toDestPoints(100, 5, 10), 200);
  assert.equal(toDestPoints(100, 10, 10), 100);
  assert.equal(srcPointsFor(50, 10, 5), 100);
  assert.equal(srcPointsFor(51, 10, 5), 102, 'arredonda para cima ao pedir');
  assert.equal(toDestPoints(7, 10, 3), 2, 'arredonda para baixo ao dar');
});

test('plano: usa a carteira que rende mais e só o necessário na última', () => {
  const plan = planShared(100, [src('a', 150, 10), src('b', 400, 10)], 10);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.parts.map((p) => [p.walletId, p.take, p.gives]), [['b', 100, 100]]);
});

test('plano: junta várias carteiras quando uma só não basta', () => {
  const plan = planShared(300, [src('a', 150, 10), src('b', 100, 10), src('c', 120, 10)], 10);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.parts.map((p) => [p.walletId, p.take]), [['a', 150], ['c', 120], ['b', 30]]);
  assert.ok(plan.covered >= 300);
});

test('plano com taxas diferentes e arredondamento a favor do cliente', () => {
  const plan = planShared(51, [src('a', 1000, 10)], 5); // 51 pts de B = 102 de A
  assert.equal(plan.ok, true);
  assert.equal(plan.parts[0].take, 102);
  assert.ok(plan.parts[0].gives >= 51);
});

test('plano: não cobre quando falta saldo e ignora carteiras vazias ou que não rendem nada', () => {
  const none = planShared(100, [src('a', 30, 10), src('b', 0, 10), src('c', 1, 1000)], 10);
  assert.equal(none.ok, false);
  assert.equal(sharedTotal([src('a', 30, 10), src('c', 1, 1000)], 10), 30);
  assert.equal(planShared(0, [], 10).ok, true);
});
