import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell, periodRange, rangeBounds, toCsv, whatsappText, type ExportRow } from './agenda-export';

const row = (over: Partial<ExportRow> = {}): ExportRow => ({
  startsAt: new Date('2026-10-12T13:00:00Z'), // 10h em Brasília
  endsAt: new Date('2026-10-12T13:45:00Z'),
  serviceName: 'Corte',
  customerName: 'Lucas Silva',
  customerPhone: '11999998888',
  resourceName: 'Lucas Barbeiro',
  status: 'CONFIRMED',
  priceCents: 5000,
  discountCents: 0,
  partySize: null,
  note: null,
  ...over,
});

test('períodos: dia, semana (seg a dom), mês e mês passado', () => {
  assert.deepEqual(periodRange('dia', '2026-10-12'), { from: '2026-10-12', to: '2026-10-12', label: '12/10' });
  const sem = periodRange('semana', '2026-10-14'); // quarta
  assert.equal(sem.from, '2026-10-12'); assert.equal(sem.to, '2026-10-18');
  assert.equal(periodRange('semana', '2026-10-18').from, '2026-10-12', 'domingo ainda é da semana que começou na segunda');
  const mes = periodRange('mes', '2026-10-12');
  assert.equal(mes.from, '2026-10-01'); assert.equal(mes.to, '2026-10-31'); assert.equal(mes.label, 'outubro de 2026');
  assert.equal(periodRange('mes', '2026-02-10').to, '2026-02-28');
  const pas = periodRange('mes-passado', '2026-10-12');
  assert.equal(pas.from, '2026-09-01'); assert.equal(pas.to, '2026-09-30');
  const jan = periodRange('mes-passado', '2026-01-05');
  assert.equal(jan.from, '2025-12-01'); assert.equal(jan.to, '2025-12-31'); assert.equal(jan.label, 'dezembro de 2025');
});

test('limites do período em UTC cobrem os dias inteiros de Brasília', () => {
  const { start, end } = rangeBounds('2026-10-12', '2026-10-13');
  assert.equal(start.toISOString(), '2026-10-12T03:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-14T03:00:00.000Z');
});

test('texto do WhatsApp: por dia, sem cancelados, com total', () => {
  const t = whatsappText(
    [row(), row({ startsAt: new Date('2026-10-12T15:00:00Z'), endsAt: new Date('2026-10-12T15:30:00Z'), serviceName: 'Barba', customerName: 'João' }), row({ status: 'CANCELED', serviceName: 'Cancelado' }), row({ startsAt: new Date('2026-10-13T13:00:00Z'), endsAt: new Date('2026-10-13T13:45:00Z'), status: 'PENDING' })],
    { who: 'Lucas Barbeiro', label: 'semana de 12/10 a 18/10' },
  );
  assert.match(t, /^Agenda de Lucas Barbeiro · semana de 12\/10 a 18\/10/);
  assert.match(t, /Seg, 12\/10\n• 10h–10h45 Corte — Lucas Silva \(11\) 99999-8888\n• 12h–12h30 Barba — João/);
  assert.match(t, /Ter, 13\/10\n• 10h–10h45 Corte — Lucas Silva .*aguardando confirmação/);
  assert.ok(!t.includes('Cancelado'));
  assert.match(t, /Total: 3 agendamentos\.$/);
  assert.match(whatsappText([], { who: null, label: 'hoje' }), /Nenhum agendamento neste período\./);
  assert.match(whatsappText([row()], { who: null, label: 'hoje' }), /\(com Lucas Barbeiro\)/, 'sem filtro, mostra o profissional');
});

test('CSV: cabeçalho, BOM, separador ; e proteção contra fórmula', () => {
  assert.equal(csvCell('=SOMA(A1)'), "'=SOMA(A1)");
  assert.equal(csvCell('+55 11'), "'+55 11");
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('diz "oi"'), '"diz ""oi"""');
  assert.equal(csvCell(null), '');
  const csv = toCsv([row({ discountCents: 1000, note: '=cmd|"/c calc"!A0', partySize: 4 })]);
  assert.ok(csv.startsWith('﻿Data;Início;Fim;Profissional;Serviço;Cliente;Telefone;Status;Valor;Desconto em pontos;A cobrar;Pessoas;Recado'));
  const line = csv.split('\r\n')[1].split(';');
  assert.equal(line[0], '12/10/2026'); assert.equal(line[1], '10:00'); assert.equal(line[2], '10:45');
  assert.equal(line[7], 'Confirmado');
  assert.ok(csv.includes(`"'=cmd|""/c calc""!A0"`), 'recado malicioso vira texto');
});
