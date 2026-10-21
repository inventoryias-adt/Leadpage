import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildClaimWhere, claimQuery, parseClaimFilter } from './claim-filters';

const now = new Date('2026-10-17T15:00:00Z'); // sábado, 12h em Brasília

test('lê os filtros dos lançamentos: padrão, atalho, datas, situação e lixo', () => {
  assert.deepEqual(parseClaimFilter({}, now), { q: '', de: null, ate: null, sit: 'todos', unid: null });
  assert.deepEqual(parseClaimFilter({ periodo: 'mes', sit: 'creditados' }, now), { q: '', de: '2026-10-01', ate: '2026-10-17', sit: 'creditados', unid: null });
  assert.equal(parseClaimFilter({ de: '2026-10-05', periodo: 'hoje' }, now).ate, null); // data digitada vale mais que o atalho
  const swapped = parseClaimFilter({ de: '2026-10-09', ate: '2026-10-02' }, now);
  assert.deepEqual([swapped.de, swapped.ate], ['2026-10-02', '2026-10-09']);
  const bad = parseClaimFilter({ sit: 'x', de: 'ontem', unid: 'abc', q: ` ${'a'.repeat(100)} ` }, now);
  assert.equal(bad.sit, 'todos'); assert.equal(bad.de, null); assert.equal(bad.unid, null); assert.equal(bad.q.length, 60);
});

test('consulta dos lançamentos: período em Brasília, situação e busca em nome, descrição e CPF', () => {
  const w = buildClaimWhere('r1', parseClaimFilter({ de: '2026-10-01', ate: '2026-10-01', q: 'maria 123', sit: 'aguardando' }, now), now) as Record<string, unknown>;
  assert.equal(w.restaurantId, 'r1');
  const createdAt = w.createdAt as { gte: Date; lt: Date };
  assert.equal(createdAt.gte.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(createdAt.lt.toISOString(), '2026-10-02T03:00:00.000Z');
  assert.equal(w.redeemedAt, null);
  assert.deepEqual(w.expiresAt, { gt: now });
  assert.equal((w.OR as unknown[]).length, 3); // com dígitos (3+) também procura no CPF
  assert.equal((buildClaimWhere('r1', parseClaimFilter({ q: 'abc' }, now), now).OR as unknown[]).length, 2);
  assert.deepEqual(buildClaimWhere('r1', parseClaimFilter({ sit: 'creditados' }, now), now).redeemedAt, { not: null });
  const expired = buildClaimWhere('r1', parseClaimFilter({ sit: 'expirados' }, now), now) as Record<string, unknown>;
  assert.equal(expired.redeemedAt, null); assert.deepEqual(expired.expiresAt, { lte: now });
  assert.deepEqual(buildClaimWhere('r1', parseClaimFilter({}, now), now), { restaurantId: 'r1' });
});

test('texto da URL dos lançamentos só leva o que foge do padrão', () => {
  assert.equal(claimQuery(parseClaimFilter({}, now)), '');
  assert.equal(claimQuery(parseClaimFilter({ q: 'bolo', sit: 'expirados', periodo: '7d' }, now)), '?q=bolo&de=2026-10-11&ate=2026-10-17&sit=expirados');
  assert.equal(claimQuery(parseClaimFilter({ q: 'bolo' }, now), { pg: '2' }), '?q=bolo&pg=2');
});
