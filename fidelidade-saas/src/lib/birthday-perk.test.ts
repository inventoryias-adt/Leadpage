import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBirthdayToday, parsePerkConfig, perkCondition, perkRewardName } from './birthday-perk';

test('aniversário hoje no relógio de Brasília', () => {
  const now = new Date('2026-10-22T15:00:00Z'); // 12:00 em Brasília, 22/10
  assert.equal(isBirthdayToday({ birthDay: 22, birthMonth: 10 }, now), true);
  assert.equal(isBirthdayToday({ birthDay: 23, birthMonth: 10 }, now), false);
  assert.equal(isBirthdayToday({ birthDay: null, birthMonth: null }, now), false);
  // 01:00 UTC de 23/10 ainda é 22/10 à noite em Brasília
  assert.equal(isBirthdayToday({ birthDay: 22, birthMonth: 10 }, new Date('2026-10-23T01:00:00Z')), true);
  assert.equal(isBirthdayToday({ birthDay: 23, birthMonth: 10 }, new Date('2026-10-23T01:00:00Z')), false);
});

test('29/02 recebe em 28/02 nos anos não bissextos', () => {
  assert.equal(isBirthdayToday({ birthDay: 29, birthMonth: 2 }, new Date('2026-02-28T15:00:00Z')), true);
  assert.equal(isBirthdayToday({ birthDay: 29, birthMonth: 2 }, new Date('2028-02-28T15:00:00Z')), false);
  assert.equal(isBirthdayToday({ birthDay: 29, birthMonth: 2 }, new Date('2028-02-29T15:00:00Z')), true);
});

test('texto da regra e nome do cupom', () => {
  assert.equal(perkCondition({ mode: 'FREE', points: 0, minCents: 0 }), 'grátis para o aniversariante');
  assert.match(perkCondition({ mode: 'POINTS', points: 300, minCents: 0 }), /^troca por 300 pontos$/);
  assert.match(perkCondition({ mode: 'SPEND', points: 0, minCents: 5000 }).replace(/ /g, ' '), /^ao consumir R\$ 50,00 ou mais$/);
  assert.equal(perkRewardName({ title: 'Sobremesa grátis', mode: 'FREE', minCents: 0 }), 'Sobremesa grátis');
  assert.match(perkRewardName({ title: 'Sobremesa', mode: 'SPEND', minCents: 5000 }).replace(/ /g, ' '), /^Sobremesa \(ao consumir R\$ 50,00 ou mais\)$/);
});

test('validação do que o dono preenche', () => {
  assert.deepEqual(parsePerkConfig({ on: 'on', title: '  Sobremesa   grátis ', mode: 'FREE' }), { ok: true, value: { on: true, title: 'Sobremesa grátis', mode: 'FREE', points: 0, minCents: 0 } });
  assert.equal(parsePerkConfig({ on: 'on', title: '', mode: 'FREE' }).ok, false);
  assert.equal(parsePerkConfig({ on: 'on', title: 'Chopp', mode: 'POINTS', points: '' }).ok, false);
  assert.deepEqual(parsePerkConfig({ on: 'on', title: 'Chopp', mode: 'POINTS', points: '300' }), { ok: true, value: { on: true, title: 'Chopp', mode: 'POINTS', points: 300, minCents: 0 } });
  assert.equal(parsePerkConfig({ on: 'on', title: 'Prato', mode: 'SPEND', min: '' }).ok, false);
  assert.deepEqual(parsePerkConfig({ on: 'on', title: 'Prato', mode: 'SPEND', min: '50,00' }), { ok: true, value: { on: true, title: 'Prato', mode: 'SPEND', points: 0, minCents: 5000 } });
  // desligado não exige nada, e modo inválido vira "grátis"
  assert.equal(parsePerkConfig({ on: undefined, title: '', mode: 'X' }).ok, true);
  assert.equal((parsePerkConfig({ on: 'on', title: 'Algo', mode: 'X' }) as { value: { mode: string } }).value.mode, 'FREE');
});
