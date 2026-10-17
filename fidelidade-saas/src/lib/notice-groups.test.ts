import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayLabel, groupByDay } from './notice-groups';

const now = new Date('2026-10-17T15:00:00Z'); // sábado, 12:00 em Brasília

test('rótulos de dia', () => {
  assert.equal(dayLabel('2026-10-17', now), 'Hoje');
  assert.equal(dayLabel('2026-10-16', now), 'Ontem');
  assert.equal(dayLabel('2026-10-12', now), 'Seg, 12/10');
  assert.equal(dayLabel('2025-12-31', now), 'Qua, 31/12/2025');
});

test('agrupa por dia de Brasília, do mais novo para o mais antigo', () => {
  const items = [
    { id: 'a', createdAt: new Date('2026-10-17T14:00:00Z') },
    { id: 'b', createdAt: new Date('2026-10-17T02:00:00Z') }, // ainda é 16/10 à noite em Brasília
    { id: 'c', createdAt: new Date('2026-10-16T20:00:00Z') },
    { id: 'd', createdAt: new Date('2026-10-12T12:00:00Z') },
  ];
  const g = groupByDay(items, now);
  assert.deepEqual(g.map((x) => [x.label, x.items.map((i) => i.id)]), [['Hoje', ['a']], ['Ontem', ['b', 'c']], ['Seg, 12/10', ['d']]]);
});
