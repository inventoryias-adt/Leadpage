import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECKIN_RADIUS_OPTIONS, maxAcceptedAccuracyM, radiusIndex } from './geo';

test('check-in: a precisão aceita acompanha o raio, com piso de 50 m', () => {
  assert.equal(maxAcceptedAccuracyM(10), 50);
  assert.equal(maxAcceptedAccuracyM(50), 50);
  assert.equal(maxAcceptedAccuracyM(200), 200); // computador com localização por Wi-Fi passa num raio grande
  assert.equal(maxAcceptedAccuracyM(500), 500);
});

test('check-in: escala do raio vai de 10 a 500 m, crescente e sem repetir', () => {
  const v = CHECKIN_RADIUS_OPTIONS.map((o) => o.value);
  assert.equal(v[0], 10);
  assert.equal(v[v.length - 1], 500);
  assert.deepEqual([...v].sort((a, b) => a - b), v);
  assert.equal(new Set(v).size, v.length);
  assert.ok(CHECKIN_RADIUS_OPTIONS.every((o) => o.hint.length > 5));
  assert.ok(v.includes(10) && v.includes(50) && v.includes(100) && v.includes(200));
});

test('check-in: posição do controle deslizante', () => {
  assert.equal(radiusIndex(10), 0);
  assert.equal(CHECKIN_RADIUS_OPTIONS[radiusIndex(200)].value, 200);
  assert.equal(CHECKIN_RADIUS_OPTIONS[radiusIndex(500)].value, 500);
  assert.equal(CHECKIN_RADIUS_OPTIONS[radiusIndex(60)].value, 50); // valor fora da escala: o mais próximo abaixo
  assert.equal(radiusIndex(1), 0);
});
