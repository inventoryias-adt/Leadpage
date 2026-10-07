import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSchedule, fmtTime, isOpenNow, parseSchedule, summarizeSchedule, type Schedule } from './hours';

const week = (over: Record<number, Partial<Schedule[number]>> = {}): Schedule =>
  defaultSchedule().map((d) => ({ ...d, open: '09:00', close: '23:00', ...over[d.day] }));

test('fmtTime', () => {
  assert.equal(fmtTime('09:00'), '9h');
  assert.equal(fmtTime('23:30'), '23h30');
  assert.equal(fmtTime('00:00'), '0h');
});

test('resumo agrupa dias iguais e separa o fim de semana', () => {
  const s = week({ 6: { open: '11:00', close: '00:00' }, 0: { open: '11:00', close: '00:00' } });
  assert.deepEqual(summarizeSchedule(s), [
    { label: 'Seg a Sex', hours: '9h às 23h' },
    { label: 'Sáb e Dom', hours: '11h às 0h' },
  ]);
});

test('resumo com dia fechado e todos iguais', () => {
  assert.deepEqual(summarizeSchedule(week()), [{ label: 'Seg a Dom', hours: '9h às 23h' }]);
  assert.deepEqual(summarizeSchedule(week({ 1: { closed: true } })), [
    { label: 'Seg', hours: 'Fechado' },
    { label: 'Ter a Dom', hours: '9h às 23h' },
  ]);
});

test('validação', () => {
  assert.ok(parseSchedule(week()));
  assert.equal(parseSchedule(week({ 1: { open: '25:00' } })), null);
  assert.equal(parseSchedule(week({ 2: { open: '10:00', close: '10:00' } })), null);
  assert.equal(parseSchedule(defaultSchedule().map((d) => ({ ...d, closed: true }))), null);
  assert.equal(parseSchedule(defaultSchedule().slice(0, 6)), null);
  assert.equal(parseSchedule('texto antigo'), null);
});

test('aberto agora (Brasília)', () => {
  const s = week();
  // 2026-10-07 é quarta-feira. 15:00 UTC = 12:00 em Brasília
  assert.equal(isOpenNow(s, new Date('2026-10-07T15:00:00Z')), true);
  // 07:00 UTC = 04:00 em Brasília → fechado
  assert.equal(isOpenNow(s, new Date('2026-10-07T07:00:00Z')), false);
  // 02:30 UTC de quinta = 23:30 de quarta em Brasília → já fechou às 23h
  assert.equal(isOpenNow(s, new Date('2026-10-08T02:30:00Z')), false);
});

test('aberto agora com horário que vira a madrugada', () => {
  const s = week({ 3: { open: '18:00', close: '02:00' } }); // quarta 18h–02h
  assert.equal(isOpenNow(s, new Date('2026-10-08T01:00:00Z')), true); // quarta 22h
  assert.equal(isOpenNow(s, new Date('2026-10-08T04:00:00Z')), true); // quinta 01h (sobra de quarta)
  assert.equal(isOpenNow(s, new Date('2026-10-08T06:00:00Z')), false); // quinta 03h
});

test('dia fechado', () => {
  const s = week({ 3: { closed: true } });
  assert.equal(isOpenNow(s, new Date('2026-10-07T15:00:00Z')), false);
});

import { todayLabel } from './hours';
test('rótulo de hoje', () => {
  const s = week({ 3: { open: '11:30', close: '22:00' }, 4: { closed: true } });
  assert.equal(todayLabel(s, new Date('2026-10-07T15:00:00Z')), 'Hoje: 11h30 às 22h'); // quarta
  assert.equal(todayLabel(s, new Date('2026-10-08T15:00:00Z')), 'Hoje: fechado'); // quinta
});
