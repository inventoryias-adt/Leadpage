import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKeyBR, describeChallenge, periodRange } from './challenges';
import { distanceMeters, formatDistance } from './geo';

test('semana vai de segunda a domingo (Brasília)', () => {
  // 2026-10-07 é quarta-feira
  const r = periodRange('WEEK', new Date('2026-10-07T15:00:00Z'));
  assert.equal(r.start.toISOString(), '2026-10-05T03:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-10-12T03:00:00.000Z');
  assert.equal(r.key, 'W2026-10-05');
  // domingo à noite ainda pertence à mesma semana; segunda 00:30 BRT já é a seguinte
  assert.equal(periodRange('WEEK', new Date('2026-10-12T02:00:00Z')).key, 'W2026-10-05');
  assert.equal(periodRange('WEEK', new Date('2026-10-12T04:00:00Z')).key, 'W2026-10-12');
});

test('mês e chave do dia em Brasília', () => {
  assert.equal(periodRange('MONTH', new Date('2026-10-07T15:00:00Z')).key, 'M2026-10');
  assert.equal(periodRange('MONTH', new Date('2026-11-01T01:00:00Z')).key, 'M2026-10'); // 31/10 22h em Brasília
  assert.equal(dayKeyBR(new Date('2026-10-08T01:00:00Z')), '2026-10-07');
});

test('descrição dos desafios', () => {
  const norm = (t: string) => t.replace(/\s/g, ' '); // formatBRL usa espaço sem quebra
  assert.equal(norm(describeChallenge({ kind: 'PURCHASES', target: 2, minAmountCents: 4200, period: 'WEEK' })), 'Compre acima de R$ 42,00 · 2 vezes na semana');
  assert.equal(describeChallenge({ kind: 'PURCHASES', target: 3, minAmountCents: 0, period: 'MONTH' }), 'Faça 3 compras no mês');
  assert.equal(describeChallenge({ kind: 'CHECKINS', target: 1, minAmountCents: 0, period: 'WEEK' }), 'Faça check-in 1 vez na semana');
});

test('distância (Haversine) e formatação', () => {
  const a = { lat: -23.5505, lng: -46.6333 };
  const b = { lat: -23.5614, lng: -46.6559 }; // ~2,6 km
  const d = distanceMeters(a, b);
  assert.ok(d > 2400 && d < 2800, String(d));
  assert.equal(distanceMeters(a, a), 0);
  assert.equal(formatDistance(7), '10 m');
  assert.equal(formatDistance(347), '350 m');
  assert.equal(formatDistance(2140), '2,1 km');
  assert.equal(formatDistance(34400), '34 km');
});
