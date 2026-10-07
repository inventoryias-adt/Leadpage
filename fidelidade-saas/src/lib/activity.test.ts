import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activitySeries, activitySince, type Movement } from './activity';

// 15/10/2026 14:30 em Brasília = 17:30 UTC
const NOW = new Date('2026-10-15T17:30:00Z');
const at = (iso: string) => new Date(iso);

test('hoje: uma coluna por hora até a hora atual, com acumulado de pontos ganhos', () => {
  const rows: Movement[] = [
    { at: at('2026-10-15T12:10:00Z'), type: 'EARN', points: 100 }, // 09h
    { at: at('2026-10-15T15:00:00Z'), type: 'EARN', points: 50 }, // 12h
    { at: at('2026-10-15T16:00:00Z'), type: 'REDEEM', points: 120 }, // 13h
    { at: at('2026-10-14T16:00:00Z'), type: 'EARN', points: 999 }, // ontem: fora
  ];
  const a = activitySeries(rows, 'hoje', NOW);
  assert.equal(a.slots.length, 15); // 00h..14h
  assert.equal(a.earned, 150);
  assert.equal(a.redeemed, 120);
  assert.equal(a.earnCount, 2);
  assert.equal(a.redeemCount, 1);
  assert.equal(a.slots[9].total, 100);
  assert.equal(a.slots[14].total, 150);
});

test('ontem: 24 colunas e só movimentos de ontem; meia-noite de Brasília separa os dias', () => {
  const rows: Movement[] = [
    { at: at('2026-10-14T02:59:00Z'), type: 'EARN', points: 10 }, // 13/10 23h59 → fora
    { at: at('2026-10-14T03:00:00Z'), type: 'EARN', points: 20 }, // 14/10 00h00
    { at: at('2026-10-15T02:59:00Z'), type: 'EARN', points: 30 }, // 14/10 23h59
    { at: at('2026-10-15T03:00:00Z'), type: 'EARN', points: 40 }, // hoje → fora
  ];
  const a = activitySeries(rows, 'ontem', NOW);
  assert.equal(a.slots.length, 24);
  assert.equal(a.earned, 50);
  assert.equal(a.slots[0].earned, 20);
  assert.equal(a.slots[23].earned, 30);
});

test('semana: 7 dias terminando hoje; mês: do dia 1 até hoje', () => {
  const rows: Movement[] = [
    { at: at('2026-10-09T15:00:00Z'), type: 'EARN', points: 70 }, // 09/10: dentro dos 7 dias
    { at: at('2026-10-08T15:00:00Z'), type: 'EARN', points: 5 }, // 08/10: fora da semana, dentro do mês
    { at: at('2026-10-01T15:00:00Z'), type: 'EARN', points: 1 },
  ];
  const w = activitySeries(rows, 'semana', NOW);
  assert.equal(w.slots.length, 7);
  assert.equal(w.slots[0].label, '09/10');
  assert.equal(w.slots[6].label, '15/10');
  assert.equal(w.earned, 70);
  const m = activitySeries(rows, 'mes', NOW);
  assert.equal(m.slots.length, 15);
  assert.equal(m.slots[0].label, '01/10');
  assert.equal(m.earned, 76);
});

test('sem movimentos: série zerada e janela de busca cobre o mês e os 8 últimos dias', () => {
  const a = activitySeries([], 'semana', NOW);
  assert.ok(a.slots.every((s) => s.total === 0));
  assert.equal(activitySince(NOW).toISOString(), '2026-10-01T03:00:00.000Z');
  // início de mês: precisa olhar o mês anterior para "semana" e "ontem"
  assert.equal(activitySince(new Date('2026-10-02T15:00:00Z')).toISOString(), '2026-09-24T03:00:00.000Z');
});
