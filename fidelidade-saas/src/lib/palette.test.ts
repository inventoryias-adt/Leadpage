import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLORS, colorOf, isColorKey, promoColor, promoDefaultColor, resourceColor } from './palette';

test('só chaves da paleta valem', () => {
  assert.equal(isColorKey('azul'), true);
  assert.equal(isColorKey('#ff0000'), false);
  assert.equal(isColorKey(''), false);
  assert.equal(isColorKey(null), false);
  assert.equal(new Set(COLORS.map((c) => c.key)).size, COLORS.length);
});

test('colorOf cai na cor da posição quando a chave não existe', () => {
  assert.equal(colorOf('verde').key, 'verde');
  assert.equal(colorOf(null, 1).key, 'verde');
  assert.equal(colorOf('xyz', 7).key, COLORS[7 % COLORS.length].key);
  assert.equal(colorOf(undefined, -1).key, COLORS[COLORS.length - 1].key);
});

test('campanha: cor escolhida ou padrão pelo público', () => {
  assert.equal(promoDefaultColor('ALL'), 'azul');
  assert.equal(promoDefaultColor('NEW'), 'verde');
  assert.equal(promoDefaultColor('INACTIVE'), 'laranja');
  assert.equal(promoColor({ color: null, audience: 'NEW' }).key, 'verde');
  assert.equal(promoColor({ color: 'roxo', audience: 'NEW' }).key, 'roxo');
  assert.equal(promoColor({ color: 'invalida', audience: 'ALL' }).key, 'azul');
});

test('resourceColor: a cor escolhida vale; sem escolha, a cor depende só do id', () => {
  assert.equal(resourceColor({ id: 'a', color: 'roxo' }).key, 'roxo');
  assert.equal(resourceColor({ id: 'abc-123' }).key, resourceColor({ id: 'abc-123', color: null }).key);
  assert.ok(COLORS.some((c) => c.key === resourceColor({ id: 'qualquer' }).key));
});
