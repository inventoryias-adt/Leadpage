import assert from 'node:assert/strict';
import test from 'node:test';
import { addDaysKey, availableSlots, bookingPoints, canCustomerCancel, dateKeyOf, dayStartUtc, formatBookingWhen, formatTimeOff, guestOf, hmOf, inPeriod, dayOccupancy, occupancyPct, parseDateKey, pickResource, timeOffBusy, timeOffRange, weekdayOf, withBuffer, type SlotInput } from './booking';
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

test('escala do profissional: só marca nos dias e horários em que ele trabalha (dentro do expediente da unidade)', () => {
  // Segunda 2026-10-12. Unidade 09–12h. João só trabalha 10–11h; Ana não trabalha às segundas.
  const joao = { id: 'j', capacity: 1, schedule: week('10:00', '11:00') };
  const ana = { id: 'a', capacity: 1, schedule: week('09:00', '12:00', [1]) };
  assert.deepEqual(times({ resources: [joao] }), ['10:00'], '60 min dentro da janela de 1h: só às 10h');
  assert.deepEqual(times({ resources: [joao], durationMin: 30 }), ['10:00', '10:30']);
  assert.deepEqual(times({ resources: [ana] }), [], 'folga: nenhum horário');
  const both = availableSlots(base({ resources: [joao, ana], durationMin: 30 }));
  assert.deepEqual(both.map((s) => s.time), ['10:00', '10:30']);
  assert.deepEqual(both[0].resourceIds, ['j']);
  // escala maior que a da unidade não passa do expediente da unidade
  assert.deepEqual(times({ resources: [{ id: 'x', capacity: 1, schedule: week('08:00', '20:00') }], durationMin: 60 }), ['09:00', '09:30', '10:00', '10:30', '11:00']);
});

test('duração por profissional: cada um leva um tempo; o horário cabe conforme quem atende', () => {
  const rapido = { id: 'r', capacity: 1, durationMin: 30 };
  const calmo = { id: 'c', capacity: 1, durationMin: 90 };
  const slots = availableSlots(base({ resources: [rapido, calmo] })); // unidade 09–12h
  const at1100 = slots.find((s) => s.time === '11:00')!;
  assert.deepEqual(at1100.resourceIds, ['r'], 'às 11h só o rápido cabe antes de fechar');
  assert.equal(at1100.durationByResource.r, 30);
  const at0900 = slots.find((s) => s.time === '09:00')!;
  assert.deepEqual(at0900.resourceIds, ['r', 'c']);
  assert.equal(at0900.durationByResource.c, 90);
  assert.equal(slots.find((s) => s.time === '10:30')!.resourceIds.includes('c'), true, '10h30 + 90 min termina exatamente às 12h');
  assert.equal(slots.find((s) => s.time === '11:00')!.resourceIds.includes('c'), false, '11h + 90 min estoura 12h');
});

test('ocupação conta por profissional e pela duração dele', () => {
  const busy = [{ resourceId: 'r', startsAt: at('09:00'), endsAt: at('09:30') }];
  const slots = availableSlots(base({ busy, resources: [{ id: 'r', capacity: 1, durationMin: 30 }, { id: 'c', capacity: 1, durationMin: 30 }] }));
  assert.deepEqual(slots.find((s) => s.time === '09:00')!.resourceIds, ['c'], 'r está ocupado, c livre');
  assert.deepEqual(slots.find((s) => s.time === '09:30')!.resourceIds, ['r', 'c']);
});

test('lembrete: só confirmados, uma vez, entre 5 e 30 min antes e que não foram feitos em cima da hora', async () => {
  const { reminderDue } = await import('./booking');
  const now = new Date('2026-10-12T12:00:00Z');
  const at = (min: number) => new Date(now.getTime() + min * 60_000);
  const base = { status: 'CONFIRMED', startsAt: at(28), createdAt: new Date('2026-10-11T12:00:00Z'), reminderSentAt: null as Date | null };
  assert.equal(reminderDue(base, now), true);
  assert.equal(reminderDue({ ...base, startsAt: at(30) }, now), true, 'no limite de 30 min');
  assert.equal(reminderDue({ ...base, startsAt: at(31) }, now), false, 'cedo demais');
  assert.equal(reminderDue({ ...base, startsAt: at(4) }, now), false, 'tarde demais');
  assert.equal(reminderDue({ ...base, status: 'PENDING' }, now), false, 'ainda não confirmado pelo dono');
  assert.equal(reminderDue({ ...base, status: 'CANCELED' }, now), false);
  assert.equal(reminderDue({ ...base, reminderSentAt: now }, now), false, 'não repete');
  assert.equal(reminderDue({ ...base, createdAt: at(-1) }, now), false, 'agendado com só 29 min de antecedência: sem lembrete');
  assert.equal(reminderDue({ ...base, createdAt: at(-10) }, now), true, 'agendado com 38 min de antecedência: lembra');
});

test('intervalo entre atendimentos: o vizinho só abre depois do intervalo, dos dois lados', () => {
  const busy = [{ resourceId: 'r1', startsAt: at('10:00'), endsAt: at('10:30') }];
  const t = (buffer: number) => times({ durationMin: 30, minNoticeMin: 0, busy: withBuffer(busy, buffer) });
  assert.deepEqual(t(0), ['09:00', '09:30', '10:30', '11:00', '11:30']);
  assert.deepEqual(t(15), ['09:00', '11:00', '11:30'], 'os vizinhos 09:30 e 10:30 ficam fechados');
  assert.equal(withBuffer(busy, 0), busy, 'sem intervalo não mexe em nada');
});

test('folga: de um profissional fecha só ele; sem profissional fecha todos', () => {
  const off = { startsAt: new Date('2026-10-21T13:00:00Z'), endsAt: new Date('2026-10-21T16:00:00Z') };
  assert.deepEqual(timeOffBusy([{ ...off, resourceId: 'a' }], ['a', 'b']).map((b) => b.resourceId), ['a']);
  assert.deepEqual(timeOffBusy([{ ...off, resourceId: null }], ['a', 'b']).map((b) => b.resourceId), ['a', 'b']);
  assert.deepEqual(timeOffBusy([{ ...off, resourceId: 'x' }], ['a', 'b']), [], 'folga de quem não atende este serviço não interfere');
});

test('timeOffRange: dia inteiro, janela de horas e entradas inválidas', () => {
  const dia = timeOffRange('2026-10-21', '2026-10-21')!;
  assert.equal(dia.startsAt.toISOString(), '2026-10-21T03:00:00.000Z');
  assert.equal(dia.endsAt.toISOString(), '2026-10-22T03:00:00.000Z');
  const semana = timeOffRange('2026-10-21', '2026-10-23')!;
  assert.equal(semana.endsAt.toISOString(), '2026-10-24T03:00:00.000Z', 'férias: até o fim do último dia');
  const almoco = timeOffRange('2026-10-21', '2026-10-21', '12:00', '13:30')!;
  assert.equal(almoco.startsAt.toISOString(), '2026-10-21T15:00:00.000Z');
  assert.equal(almoco.endsAt.toISOString(), '2026-10-21T16:30:00.000Z');
  assert.equal(timeOffRange('2026-10-22', '2026-10-21'), null, 'fim antes do início');
  assert.equal(timeOffRange('2026-10-21', '2026-10-21', '14:00', '13:00'), null, 'hora de fim antes da de início');
  assert.equal(timeOffRange('2026-10-21', '2026-10-21', '12:00'), null, 'só uma das horas');
  assert.equal(timeOffRange('2026-13-01', '2026-13-01'), null, 'data inexistente');
});

test('guestOf: cliente do app ou convidado do encaixe', () => {
  assert.deepEqual(guestOf({ customer: { name: 'Ana', phone: '11999990000' }, guestName: null, guestPhone: null }), { name: 'Ana', phone: '11999990000', hasAccount: true });
  assert.deepEqual(guestOf({ customer: null, guestName: 'João', guestPhone: '11988887777' }), { name: 'João', phone: '11988887777', hasAccount: false });
  assert.equal(guestOf({ customer: null, guestName: null, guestPhone: null }).name, 'Cliente');
});

test('formatTimeOff: dia inteiro, janela no mesmo dia e períodos longos', () => {
  const r = (a: string, b: string, h1?: string, h2?: string) => { const x = timeOffRange(a, b, h1, h2)!; return formatTimeOff(x.startsAt, x.endsAt); };
  assert.equal(r('2026-10-21', '2026-10-21'), 'Qua, 21/10 · dia inteiro');
  assert.equal(r('2026-10-21', '2026-10-23'), 'Qua, 21/10 a Sex, 23/10 · dias inteiros');
  assert.equal(r('2026-10-21', '2026-10-21', '14:00', '16:00'), 'Qua, 21/10 · 14h–16h');
  assert.equal(r('2026-10-21', '2026-10-21', '12:30', '13:30'), 'Qua, 21/10 · 12h30–13h30');
  assert.equal(r('2026-10-21', '2026-10-22', '18:00', '09:00'), 'Qua, 21/10 às 18h até Qui, 22/10 às 9h');
});

test('inPeriod: manhã, tarde, noite e qualquer horário', () => {
  assert.equal(inPeriod('09:30', 'MORNING'), true);
  assert.equal(inPeriod('12:00', 'MORNING'), false);
  assert.equal(inPeriod('12:00', 'AFTERNOON'), true);
  assert.equal(inPeriod('17:45', 'AFTERNOON'), true);
  assert.equal(inPeriod('18:00', 'AFTERNOON'), false);
  assert.equal(inPeriod('18:00', 'EVENING'), true);
  assert.equal(inPeriod('03:00', 'ANY'), true);
});

test('ocupação do dia: capacidade do expediente, folgas unidas e agendamentos contados', () => {
  const r = { id: 'r1', capacity: 1 };
  const empty = dayOccupancy({ date: '2026-10-12', schedule: week('09:00', '12:00'), resources: [r], bookings: [], timeOffs: [] });
  assert.deepEqual([empty.capacityMin, empty.bookedMin, occupancyPct(empty)], [180, 0, 0]);

  const busy = [{ resourceId: 'r1', startsAt: at('09:00'), endsAt: at('10:30') }];
  const half = dayOccupancy({ date: '2026-10-12', schedule: week('09:00', '12:00'), resources: [r], bookings: busy, timeOffs: [] });
  assert.equal(occupancyPct(half), 50);

  // Duas folgas que se sobrepõem (10h–11h e 10h30–11h30) bloqueiam 90 min, não 120.
  const offs = [
    { resourceId: null, startsAt: at('10:00'), endsAt: at('11:00') },
    { resourceId: 'r1', startsAt: at('10:30'), endsAt: at('11:30') },
  ];
  const withOff = dayOccupancy({ date: '2026-10-12', schedule: week('09:00', '12:00'), resources: [r], bookings: busy, timeOffs: offs });
  assert.equal(withOff.capacityMin, 90);
  assert.equal(withOff.bookedMin, 90);
  assert.equal(occupancyPct(withOff), 100);

  // Folga do dia inteiro: sem capacidade, sem percentual.
  const allDay = dayOccupancy({ date: '2026-10-12', schedule: week('09:00', '12:00'), resources: [r], bookings: [], timeOffs: [{ resourceId: null, startsAt: at('00:00'), endsAt: at('00:00', '2026-10-13') }] });
  assert.equal(occupancyPct(allDay), null);
});

test('ocupação do dia: escala do profissional, dia fechado e vagas simultâneas', () => {
  const schedule = week('09:00', '18:00', [0]);
  const ana = { id: 'ana', capacity: 1, schedule: week('13:00', '17:00') };
  const mesa = { id: 'mesa', capacity: 3 };
  const o = dayOccupancy({ date: '2026-10-12', schedule, resources: [ana, mesa], bookings: [], timeOffs: [] });
  assert.equal(o.byResource.ana.capacityMin, 240); // só a escala dela (13h–17h)
  assert.equal(o.byResource.mesa.capacityMin, 9 * 60 * 3); // três mesas ao mesmo tempo
  // Domingo fechado: nada a atender.
  const sunday = dayOccupancy({ date: '2026-10-11', schedule, resources: [ana, mesa], bookings: [], timeOffs: [] });
  assert.deepEqual([sunday.capacityMin, occupancyPct(sunday)], [0, null]);
  // Reservas além da capacidade não passam de 100%.
  const crowded = dayOccupancy({ date: '2026-10-12', schedule: week('09:00', '10:00'), resources: [{ id: 'r', capacity: 1 }], bookings: [{ resourceId: 'r', startsAt: at('08:00'), endsAt: at('12:00') }], timeOffs: [] });
  assert.equal(occupancyPct(crowded), 100);
});
