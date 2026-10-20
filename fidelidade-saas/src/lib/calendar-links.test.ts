import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, directionsUrl, googleCalendarUrl } from './calendar-links';
import { formatCountdown, nearestSlots } from './booking';

const ev = { uid: 'abc', title: 'Corte, barba; e mais', startsAt: new Date('2026-10-21T17:30:00Z'), endsAt: new Date('2026-10-21T18:15:00Z'), location: 'Rua A, 10', description: 'Linha 1\nLinha 2' };

test('ics: campos obrigatórios, datas em UTC e escapes', () => {
  const ics = buildIcs(ev, new Date('2026-10-20T12:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART:20261021T173000Z\r\n/);
  assert.match(ics, /DTEND:20261021T181500Z\r\n/);
  assert.match(ics, /DTSTAMP:20261020T120000Z\r\n/);
  const bs = String.fromCharCode(92);
  assert.ok(ics.includes(`SUMMARY:Corte${bs}, barba${bs}; e mais\r\n`));
  assert.match(ics, /DESCRIPTION:Linha 1\\nLinha 2\r\n/);
  assert.match(ics, /UID:abc@fidelize\r\n/);
  assert.match(ics, /TRIGGER:-PT1H/);
});

test('ics: linhas longas são dobradas em 75 caracteres', () => {
  const ics = buildIcs({ ...ev, description: 'x'.repeat(200) });
  for (const line of ics.split('\r\n')) assert.ok(line.length <= 75, `linha com ${line.length}`);
  assert.match(ics, /\r\n x/);
});

test('links do Google Agenda e de rota', () => {
  const g = new URL(googleCalendarUrl(ev));
  assert.equal(g.searchParams.get('dates'), '20261021T173000Z/20261021T181500Z');
  assert.equal(g.searchParams.get('location'), 'Rua A, 10');
  assert.equal(directionsUrl('Rua A, 10 - SP'), 'https://www.google.com/maps/dir/?api=1&destination=Rua%20A%2C%2010%20-%20SP');
});

test('nearestSlots: mais perto primeiro, empate no mais cedo, sem o horário pedido', () => {
  const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00'].map((time) => ({ time }));
  assert.deepEqual(nearestSlots(slots, '10:00', 3).map((s) => s.time), ['09:30', '10:30', '09:00']);
  assert.deepEqual(nearestSlots(slots, '13:30', 2).map((s) => s.time), ['14:00', '11:00']);
  assert.deepEqual(nearestSlots([], '10:00', 3), []);
});

test('contador da reserva', () => {
  assert.equal(formatCountdown(300_000), '5:00');
  assert.equal(formatCountdown(61_500), '1:02');
  assert.equal(formatCountdown(-5), '0:00');
});
