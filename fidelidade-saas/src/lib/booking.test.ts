import assert from 'node:assert/strict';
import test from 'node:test';
import { addDaysKey, availableSlots, bookingPoints, canCustomerCancel, dateKeyOf, dayStartUtc, formatBookingWhen, hmOf, parseDateKey, pickResource, weekdayOf, type SlotInput } from './booking';
import type { Schedule } from './hours';

const week = (open: string, close: string, closedDays: number[] = []): Schedule => Array.from({ length: 7 }, (_, day) => ({ day, closed: closedDays.includes(day), open, close }));
// 2026-10-12 é uma segunda-feira. "now" = domingo 11/10/2026 12:00 em Brasília (15:00 UTC).
const NOW = new Date('2026-10-11T15:00:00Z');
const base = (over: Partial<SlotInput> = {}): SlotInput => ({
  date: '2026-10-12',
  schedule: week('09:00', '12:00'),
  durationMin: 60,
  resources: [{ id: 'r1', capacity: 1 }],
  busy: [],
  now: NOW,
  minNoticeMin: 60,
  maxDaysAhead: 30,
  ...over,
});
const times = (o: Partial<SlotInput> = {}) => availableSlots(base(o)).map((s) => s.time);
const at = (hm: string, date = '2026-10-12') => new Date(dayStartUtc(date).getTime() + (Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3))) * 60_000);

test('datas de Brasília: validação, dia da semana, meia-noite e ida e volta', () => {
  assert.equal(parseDateKey('2026-02-30'), null);
  assert.equal(parseDateKey('12/10/2026'), null);
  assert.deepEqual(parseDateKey('2026-10-12'), { y: 2026, m: 10, d: 12 });
  assert.equal(weekdayOf('2026-10-12'), 1);
  assert.equal(dayStartUtc('2026-10-12').toISOString(), '2026-10-12T03:00:00.000Z');
  assert.equal(dateKeyOf(new Date('2026-10-13T02:30:00Z')), '2026-10-12', '23h30 de Brasília ainda é dia 12');
  assert.equal(hmOf(new Date('2026-10-12T17:30:00Z')), '14:30');
  assert.equal(addDaysKey('2026-10-31', 1), '2026-11-01');
  assert.equal(addDaysKey('2026-12-31', 1), '2027-01-01');
});

test('horários livres de um dia simples: de meia em meia hora, cabendo o serviço antes de fechar', () => {
  assert.deepEqual(times(), ['09:00', '09:30', '10:00', '10:30', '11:00']);
  assert.deepEqual(times({ durationMin: 90 }), ['09:00', '09:30', '10:00', '10:30']);
  assert.deepEqual(times({ durationMin: 20 }).slice(0, 4), ['09:00', '09:15', '09:30', '09:45'], 'serviço curto: de 15 em 15');
});

test('dia fechado, sem horário cadastrado, sem recurso, passado ou longe demais: nenhum horário', () => {
  assert.deepEqual(times({ schedule: week('09:00', '12:00', [1]) }), []);
  assert.deepEqual(times({ schedule: null }), []);
  assert.deepEqual(times({ resources: [] }), []);
  assert.deepEqual(times({ date: '2026-10-10' }), [], 'dia que já passou');
  assert.deepEqual(times({ date: '2026-12-01' }), [], 'além do limite de dias');
  assert.deepEqual(times({ date: '2026-10-11', schedule: week('09:00', '12:00') }), [], 'hoje às 12h, expediente já acabou');
});

test('antecedência mínima esconde os horários que já estão perto demais', () => {
  const now = new Date('2026-10-12T12:20:00Z'); // 09:20 em Brasília
  assert.deepEqual(times({ now, minNoticeMin: 60 }), ['10:30', '11:00'], '09:20 + 1h = 10:20 → o primeiro de meia em meia hora é 10:30');
  assert.deepEqual(times({ now, minNoticeMin: 0 }), ['09:30', '10:00', '10:30', '11:00']);
});

test('agendamento existente tira os horários que se sobrepõem; capacidade maior deixa passar', () => {
  const busy = [{ resourceId: 'r1', startsAt: at('10:00'), endsAt: at('11:00') }];
  assert.deepEqual(times({ busy }), ['09:00', '11:00'], '9h30 invade o das 10h; 10h e 10h30 também');
  assert.deepEqual(times({ busy, resources: [{ id: 'r1', capacity: 2 }] }), ['09:00', '09:30', '10:00', '10:30', '11:00']);
  const full = [busy[0], { resourceId: 'r1', startsAt: at('10:00'), endsAt: at('11:00') }];
  assert.deepEqual(times({ busy: full, resources: [{ id: 'r1', capacity: 2 }] }), ['09:00', '11:00']);
});

test('vários profissionais: o horário aparece se algum estiver livre e lista quem está livre', () => {
  const busy = [{ resourceId: 'r1', startsAt: at('10:00'), endsAt: at('11:00') }];
  const slots = availableSlots(base({ busy, resources: [{ id: 'r1', capacity: 1 }, { id: 'r2', capacity: 1 }] }));
  const s10 = slots.find((s) => s.time === '10:00')!;
  assert.deepEqual(s10.resourceIds, ['r2']);
  assert.deepEqual(slots.find((s) => s.time === '09:00')!.resourceIds, ['r1', 'r2']);
});

test('expediente que vira a madrugada (18h às 02h)', () => {
  const t = times({ schedule: week('18:00', '02:00'), durationMin: 60 });
  assert.equal(t[0], '18:00');
  assert.equal(t[t.length - 1], '01:00');
  assert.ok(t.includes('00:00'));
});

test('escolha do profissional: o com menos agendamentos no dia; empate pela ordem', () => {
  const busy = [
    { resourceId: 'a', startsAt: at('09:00'), endsAt: at('10:00') },
    { resourceId: 'a', startsAt: at('10:00'), endsAt: at('11:00') },
    { resourceId: 'b', startsAt: at('09:00'), endsAt: at('10:00') },
  ];
  assert.equal(pickResource(['a', 'b'], busy), 'b');
  assert.equal(pickResource(['a', 'c'], busy), 'c');
  assert.equal(pickResource(['z', 'y'], []), 'y');
  assert.equal(pickResource([], busy), null);
});

test('cancelamento pelo cliente: só pendente/confirmado e até X horas antes', () => {
  const start = new Date('2026-10-12T15:00:00Z');
  assert.equal(canCustomerCancel({ status: 'CONFIRMED', startsAt: start }, 2, new Date('2026-10-12T12:59:00Z')), true);
  assert.equal(canCustomerCancel({ status: 'CONFIRMED', startsAt: start }, 2, new Date('2026-10-12T13:01:00Z')), false);
  assert.equal(canCustomerCancel({ status: 'CANCELED', startsAt: start }, 2, new Date('2026-10-12T00:00:00Z')), false);
  assert.equal(canCustomerCancel({ status: 'COMPLETED', startsAt: start }, 0, new Date('2026-10-11T00:00:00Z')), false);
});

test('pontos do atendimento e texto do horário', () => {
  assert.equal(bookingPoints(8000, 10), 800);
  assert.equal(bookingPoints(0, 10), 0);
  assert.equal(bookingPoints(1999, 10), 199, 'arredonda para baixo, como no caixa');
  assert.equal(formatBookingWhen(new Date('2026-10-12T17:30:00Z')), 'Seg, 12/10 às 14h30');
  assert.equal(formatBookingWhen(new Date('2026-10-12T12:00:00Z')), 'Seg, 12/10 às 9h');
});
