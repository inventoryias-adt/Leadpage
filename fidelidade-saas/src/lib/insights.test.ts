import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailySeries, deltaPct, heatmap, peakSlot, segmentsOf, suggestions, type SuggestionCtx } from './insights';

const now = new Date('2026-10-07T15:00:00Z'); // quarta, 12h em Brasília
const ago = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

test('série por dia, em Brasília, com dias vazios', () => {
  const rows = [
    { at: new Date('2026-10-07T02:30:00Z'), cents: 1000, points: 100 }, // 6/10 23h30 em Brasília
    { at: new Date('2026-10-07T13:00:00Z'), cents: 2000, points: 200 },
    { at: new Date('2026-10-07T14:00:00Z'), cents: 500, points: 50 },
  ];
  const s = dailySeries(rows, 3, now);
  assert.deepEqual(s.map((b) => b.ymd), ['2026-10-05', '2026-10-06', '2026-10-07']);
  assert.deepEqual(s.map((b) => b.cents), [0, 1000, 2500]);
  assert.deepEqual(s.map((b) => b.count), [0, 1, 2]);
  assert.equal(s[2].label, '07/10');
});

test('mapa de horários e pico', () => {
  const grid = heatmap([{ at: new Date('2026-10-07T22:00:00Z') }, { at: new Date('2026-10-07T22:30:00Z') }, { at: new Date('2026-10-06T15:00:00Z') }]);
  assert.equal(grid[3][19], 2); // quarta, 19h
  assert.equal(grid[2][12], 1); // terça, 12h
  assert.deepEqual(peakSlot(grid), { dow: 3, hour: 19, count: 2 });
  assert.equal(peakSlot(heatmap([])), null);
});

test('variação percentual', () => {
  assert.equal(deltaPct(150, 100), 50);
  assert.equal(deltaPct(50, 100), -50);
  assert.equal(deltaPct(10, 0), null);
  assert.equal(deltaPct(0, 0), 0);
});

test('segmentos de clientes', () => {
  const base = { createdAt: ago(200), purchases: 0, lastPurchaseAt: null, balance: 0, minReward: 500 };
  assert.deepEqual(segmentsOf({ ...base, createdAt: ago(5) }, now), ['novos']);
  assert.deepEqual(segmentsOf({ ...base, purchases: 6, lastPurchaseAt: ago(10) }, now), ['fieis']);
  assert.deepEqual(segmentsOf({ ...base, purchases: 6, lastPurchaseAt: ago(60) }, now), ['sumidos']);
  assert.deepEqual(segmentsOf({ ...base, purchases: 2, lastPurchaseAt: ago(3), balance: 360 }, now), ['quase']);
  assert.deepEqual(segmentsOf({ ...base, purchases: 2, lastPurchaseAt: ago(3), balance: 349 }, now), []);
  assert.deepEqual(segmentsOf({ ...base, purchases: 2, lastPurchaseAt: ago(3), balance: 500 }, now), []); // já pode resgatar
});

test('sugestões: máximo de 4, as do que os números mostram primeiro', () => {
  const ctx: SuggestionCtx = { customers: 10, purchasesInPeriod: 5, promosCount: 0, challengesCount: 0, rewardsCount: 2, rewardsWithoutPhoto: 2, unitsWithoutLocation: 1, referralPoints: 0, checkInPoints: 1, hasLogo: false, hasCover: false, sumidos: 3, quase: 2, peak: { dow: 5, hour: 19 } };
  const s = suggestions(ctx);
  assert.equal(s.length, 4);
  assert.deepEqual(s.slice(0, 2).map((x) => x.id), ['quase', 'sumidos']);
  assert.match(s[2].text, /sexta/);
  const tudo: SuggestionCtx = { ...ctx, promosCount: 1, challengesCount: 1, rewardsWithoutPhoto: 0, unitsWithoutLocation: 0, referralPoints: 30, hasLogo: true, hasCover: true, sumidos: 0, quase: 0 };
  assert.deepEqual(suggestions(tudo), []);
  assert.equal(suggestions({ ...tudo, purchasesInPeriod: 0 })[0].id, 'parado');
});
