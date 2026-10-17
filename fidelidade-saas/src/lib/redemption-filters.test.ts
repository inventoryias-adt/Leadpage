import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildWhere, filterQuery, parseFilter, presetRange } from './redemption-filters';

const now = new Date('2026-10-17T15:00:00Z'); // sábado, 12h em Brasília

test('atalhos de período', () => {
  assert.deepEqual(presetRange('hoje', now), { de: '2026-10-17', ate: '2026-10-17' });
  assert.deepEqual(presetRange('7d', now), { de: '2026-10-11', ate: '2026-10-17' });
  assert.deepEqual(presetRange('mes', now), { de: '2026-10-01', ate: '2026-10-17' });
  assert.deepEqual(presetRange('mes-passado', now), { de: '2026-09-01', ate: '2026-09-30' });
  assert.deepEqual(presetRange('mes-passado', new Date('2026-01-10T12:00:00Z')), { de: '2025-12-01', ate: '2025-12-31' });
});

test('lê os filtros: padrão, atalho, datas e lixo', () => {
  assert.deepEqual(parseFilter({}, now), { st: 'pendentes', q: '', de: null, ate: null, unid: null });
  assert.deepEqual(parseFilter({ st: 'todos', periodo: 'mes' }, now), { st: 'todos', q: '', de: '2026-10-01', ate: '2026-10-17', unid: null });
  assert.equal(parseFilter({ de: '2026-10-05', periodo: 'hoje' }, now).ate, null); // data digitada vale mais que o atalho
  assert.deepEqual(parseFilter({ de: '2026-10-09', ate: '2026-10-02' }, now), { st: 'pendentes', q: '', de: '2026-10-02', ate: '2026-10-09', unid: null });
  const bad = parseFilter({ st: 'x', de: 'ontem', unid: 'abc' }, now);
  assert.equal(bad.st, 'pendentes'); assert.equal(bad.de, null); assert.equal(bad.unid, null);
});

test('consulta: status, período em Brasília e busca em código, prêmio, cliente e CPF', () => {
  const w = buildWhere('r1', parseFilter({ st: 'entregues', de: '2026-10-01', ate: '2026-10-01', q: 'maria 123' }, now)) as Record<string, unknown>;
  assert.equal(w.restaurantId, 'r1'); assert.equal(w.status, 'USED');
  const usedAt = w.usedAt as { gte: Date; lt: Date };
  assert.equal(usedAt.gte.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(usedAt.lt.toISOString(), '2026-10-02T03:00:00.000Z');
  assert.equal((w.OR as unknown[]).length, 4); // com dígitos (3+) também procura no CPF
  assert.equal(((buildWhere('r1', parseFilter({ q: 'abc' }, now)).OR) as unknown[]).length, 3);
  assert.equal(buildWhere('r1', parseFilter({}, now)).status, 'PENDING');
  assert.ok('createdAt' in buildWhere('r1', parseFilter({ st: 'todos', de: '2026-10-01' }, now)));
});

test('texto da URL só leva o que foge do padrão', () => {
  assert.equal(filterQuery(parseFilter({}, now)), '');
  assert.equal(filterQuery(parseFilter({ st: 'entregues', q: 'bolo', periodo: '7d' }, now)), '?st=entregues&q=bolo&de=2026-10-11&ate=2026-10-17');
  assert.equal(filterQuery(parseFilter({ st: 'todos' }, now), { pg: '2' }), '?st=todos&pg=2');
});
