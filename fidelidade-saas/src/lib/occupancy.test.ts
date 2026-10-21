import assert from 'node:assert/strict';
import test from 'node:test';
import { dayStartUtc } from './booking';
import type { Schedule } from './hours';
import { formatHours, occupancyReport } from './occupancy';

const week = (open: string, close: string, closedDays: number[] = []): Schedule => Array.from({ length: 7 }, (_, day) => ({ day, closed: closedDays.includes(day), open, close }));
const at = (date: string, h: number, m = 0) => new Date(dayStartUtc(date).getTime() + (h * 60 + m) * 60_000);

test('relatório de ocupação: soma por dia, profissional e totais; dia fechado sem percentual', () => {
  // 2026-10-10 é sábado (fechado); 11 domingo; 12 segunda.
  const report = occupancyReport({
    from: '2026-10-10',
    days: 3,
    units: [{ id: 'u1', schedule: week('09:00', '13:00', [6, 0]) }],
    resources: [{ id: 'a', unitId: null, capacity: 1 }, { id: 'b', unitId: null, capacity: 1 }],
    bookings: [
      { resourceId: 'a', startsAt: at('2026-10-12', 9), endsAt: at('2026-10-12', 11) },
      { resourceId: 'b', startsAt: at('2026-10-12', 9), endsAt: at('2026-10-12', 10) },
    ],
    timeOffs: [],
  });
  assert.deepEqual(report.days.map((d) => d.pct), [null, null, 38]); // 180 de 480 min
  assert.deepEqual(report.days.map((d) => d.bookings), [0, 0, 2]);
  assert.equal(report.byResource.a.bookedMin, 120);
  assert.equal(report.totals.freeMin, 300);
  assert.equal(report.totals.pct, 38);
});

test('relatório de ocupação: profissional de outra unidade e folga de uma unidade só', () => {
  const report = occupancyReport({
    from: '2026-10-12',
    days: 1,
    units: [{ id: 'u1', schedule: week('09:00', '10:00') }, { id: 'u2', schedule: week('09:00', '10:00') }],
    resources: [{ id: 'a', unitId: 'u1', capacity: 1 }, { id: 'b', unitId: 'u2', capacity: 1 }],
    bookings: [],
    timeOffs: [{ unitId: 'u2', resourceId: null, startsAt: at('2026-10-12', 0), endsAt: at('2026-10-13', 0) }],
  });
  assert.equal(report.totals.capacityMin, 60); // só a unidade 1 atende
  assert.deepEqual(Object.keys(report.byResource).sort(), ['a', 'b']);
  assert.equal(report.byResource.b.capacityMin, 0);
});

test('relatório de ocupação: profissional em duas unidades conta uma vez só', () => {
  const report = occupancyReport({
    from: '2026-10-12',
    days: 1,
    units: [{ id: 'u1', schedule: week('09:00', '18:00') }, { id: 'u2', schedule: week('09:00', '18:00') }],
    resources: [{ id: 'ana', unitId: null, capacity: 1 }],
    bookings: [{ resourceId: 'ana', startsAt: at('2026-10-12', 9), endsAt: at('2026-10-12', 18) }],
    timeOffs: [],
  });
  assert.equal(report.totals.capacityMin, 540);
  assert.equal(report.totals.pct, 100);
});

test('formatHours', () => {
  assert.equal(formatHours(180), '3h');
  assert.equal(formatHours(90), '1h30');
  assert.equal(formatHours(45), '45min');
  assert.equal(formatHours(0), '0h');
});
