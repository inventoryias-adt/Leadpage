import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayLabel, groupByDay, monthLabel, monthRange, monthsOf, parseMonthKey } from './notice-groups';

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

test('mês: validação, rótulo e intervalo (Brasília)', () => {
  assert.equal(parseMonthKey('2026-10'), '2026-10');
  assert.equal(parseMonthKey('2026-13'), null);
  assert.equal(parseMonthKey('out'), null);
  assert.equal(parseMonthKey(undefined), null);
  assert.equal(monthLabel('2026-10'), 'out/2026');
  const r = monthRange('2026-10');
  assert.equal(r.from.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(r.to.toISOString(), '2026-11-01T03:00:00.000Z');
  assert.equal(monthRange('2026-12').to.toISOString(), '2027-01-01T03:00:00.000Z');
});

test('meses com aviso, do mais novo para o mais antigo, no relógio de Brasília', () => {
  const dates = [
    new Date('2026-11-01T02:00:00Z'), // ainda é 31/10 à noite em Brasília
    new Date('2026-10-20T12:00:00Z'),
    new Date('2026-09-30T12:00:00Z'),
    new Date('2026-10-02T12:00:00Z'),
  ];
  assert.deepEqual(monthsOf(dates), [
    { key: '2026-10', label: 'out/2026', count: 3 },
    { key: '2026-09', label: 'set/2026', count: 1 },
  ]);
});
