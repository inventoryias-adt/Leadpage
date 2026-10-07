import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyPromos, endOfDayBR, promoActiveAt, promoBadge, promoStatus, promoWhen, startOfDayBR, weekdaysText, type PromoLike } from './promos';

const base: PromoLike = { title: 'Terça em dobro', kind: 'MULTIPLIER', multiplier: 2, bonusPoints: null, minAmountCents: 0, startsAt: null, endsAt: null, weekdays: [], startTime: null, endTime: null, active: true };
// 2026-10-06 é terça-feira. 21:00 UTC = 18:00 em Brasília.
const tue18 = new Date('2026-10-06T21:00:00Z');
const wed18 = new Date('2026-10-07T21:00:00Z');

test('dia da semana e horário valem em Brasília', () => {
  const p = { ...base, weekdays: [2], startTime: '18:00', endTime: '22:00' };
  assert.equal(promoActiveAt(p, tue18), true);
  assert.equal(promoActiveAt(p, new Date('2026-10-06T20:59:00Z')), false); // 17h59
  assert.equal(promoActiveAt(p, new Date('2026-10-07T01:00:00Z')), false); // 22h
  assert.equal(promoActiveAt(p, wed18), false);
  // 01:00 UTC de quarta ainda é terça à noite em Brasília (22h) — fora da janela, mas 00:30 UTC (21h30) dentro
  assert.equal(promoActiveAt(p, new Date('2026-10-07T00:30:00Z')), true);
});

test('janela que atravessa a meia-noite', () => {
  const p = { ...base, startTime: '22:00', endTime: '02:00' };
  assert.equal(promoActiveAt(p, new Date('2026-10-07T02:00:00Z')), true); // 23h
  assert.equal(promoActiveAt(p, new Date('2026-10-07T04:00:00Z')), true); // 01h
  assert.equal(promoActiveAt(p, new Date('2026-10-07T12:00:00Z')), false); // 09h
});

test('período por datas inclui o dia final inteiro', () => {
  const p = { ...base, startsAt: startOfDayBR('2026-10-10'), endsAt: endOfDayBR('2026-10-12') };
  assert.equal(promoActiveAt(p, new Date('2026-10-10T02:59:00Z')), false);
  assert.equal(promoActiveAt(p, new Date('2026-10-10T03:00:00Z')), true);
  assert.equal(promoActiveAt(p, new Date('2026-10-13T02:59:00Z')), true); // 23h59 de 12/10
  assert.equal(promoActiveAt(p, new Date('2026-10-13T03:00:00Z')), false);
  assert.equal(promoStatus(p, new Date('2026-10-20T12:00:00Z')), 'ended');
  assert.equal(promoStatus(p, new Date('2026-10-01T12:00:00Z')), 'scheduled');
  assert.equal(promoStatus({ ...p, active: false }, new Date('2026-10-11T12:00:00Z')), 'paused');
});

test('multiplicador usa o maior; pontos extras somam; mínimo da conta é respeitado', () => {
  const x3 = { ...base, title: '3x', multiplier: 3 };
  const bonus = { ...base, title: '+50', kind: 'BONUS' as const, multiplier: null, bonusPoints: 50, minAmountCents: 4000 };
  const r = applyPromos(100, 5000, [base, x3, bonus], tue18);
  assert.equal(r.points, 100 * 3 + 50);
  assert.deepEqual(r.applied.map((p) => p.title), ['3x', '+50']);
  assert.equal(applyPromos(100, 3000, [bonus], tue18).points, 100); // abaixo do mínimo
  assert.equal(applyPromos(100, 3000, [], tue18).points, 100);
  assert.equal(applyPromos(10, 1000, [{ ...base, multiplier: 1.5 }], tue18).points, 15);
});

test('textos', () => {
  assert.equal(weekdaysText([2, 4]), 'ter e qui');
  assert.equal(weekdaysText([]), 'todos os dias');
  assert.equal(weekdaysText([2]), 'terça');
  assert.equal(promoBadge(base), '2x pontos');
  assert.equal(promoBadge({ kind: 'BONUS', multiplier: null, bonusPoints: 50 }), '+50 pontos');
  assert.equal(promoBadge({ kind: 'MULTIPLIER', multiplier: 1.5, bonusPoints: null }), '1,5x pontos');
  const money = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
  assert.equal(promoWhen({ ...base, weekdays: [2, 4], startTime: '18:00', endTime: '22:30', minAmountCents: 4000 }, money), 'Ter e qui, das 18h às 22h30, em compras a partir de R$ 40,00');
});
