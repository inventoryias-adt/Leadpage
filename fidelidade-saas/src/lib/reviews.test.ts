import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_REVIEWS_FOR_RANK, cleanText, compareByRating, displayName, formatAvg, parseRating, reviewWindowOpen, starsText, summarize } from './reviews';

test('nota válida é inteira de 1 a 5', () => {
  for (const ok of [1, 2, 3, 4, 5, '1', '5', ' 3 ']) assert.ok(parseRating(ok), String(ok));
  for (const bad of [0, 6, -1, 3.5, '3.5', '', 'abc', null, undefined, NaN, '0', '6', '1e1']) assert.equal(parseRating(bad), null, String(bad));
});

test('comentário: limpa espaços, vazio vira nulo e corta em 500', () => {
  assert.equal(cleanText('  ótimo   atendimento \n\n\n\n valeu  '), 'ótimo atendimento\n\nvaleu');
  assert.equal(cleanText('   '), null);
  assert.equal(cleanText(undefined), null);
  assert.equal(cleanText(42), null);
  assert.equal(cleanText('a'.repeat(900))?.length, 500);
  assert.equal(cleanText('a'.repeat(900), 100)?.length, 100);
});

test('prazo para avaliar: até 30 dias depois de concluir', () => {
  const done = new Date('2026-10-01T12:00:00Z');
  assert.equal(reviewWindowOpen(done, new Date('2026-10-01T12:00:01Z')), true);
  assert.equal(reviewWindowOpen(done, new Date('2026-10-31T12:00:00Z')), true);
  assert.equal(reviewWindowOpen(done, new Date('2026-10-31T12:00:01Z')), false);
  assert.equal(reviewWindowOpen(done, new Date('2026-10-01T11:59:00Z')), false, 'antes de concluir não vale');
  assert.equal(reviewWindowOpen(null), false);
});

test('média com uma casa e só aparece com 3 avaliações ou mais', () => {
  assert.deepEqual(summarize([]), { count: 0, avg: null, ranked: false });
  assert.deepEqual(summarize([5, 4]), { count: 2, avg: 4.5, ranked: false });
  assert.deepEqual(summarize([5, 4, 4]), { count: 3, avg: 4.3, ranked: true });
  assert.equal(MIN_REVIEWS_FOR_RANK, 3);
  assert.deepEqual(summarize([5, 5, 5, 9 as number, 0 as number]), { count: 3, avg: 5, ranked: true }, 'notas fora de 1 a 5 são ignoradas');
  assert.equal(formatAvg(4.3), '4,3');
  assert.equal(formatAvg(5), '5,0');
});

test('nome exibido: primeiro nome e inicial do último', () => {
  assert.equal(displayName('Maria Souza Lima'), 'Maria L.');
  assert.equal(displayName('  joão   da silva '), 'João S.');
  assert.equal(displayName('Ana'), 'Ana');
  assert.equal(displayName(''), 'Cliente');
  assert.equal(displayName(null), 'Cliente');
  assert.equal(displayName('MARINA SOUZA'), 'Marina S.');
});

test('estrelas em texto', () => {
  assert.equal(starsText(4), '★★★★☆');
  assert.equal(starsText(5), '★★★★★');
  assert.equal(starsText(0), '☆☆☆☆☆');
  assert.equal(starsText(4.6), '★★★★★');
});

test('ranking: com nota válida primeiro (maior média, depois mais avaliações); sem nota no fim', () => {
  const a = summarize([5, 5, 4]); // 4,7 · 3
  const b = summarize([5, 5, 5, 4]); // 4,8 · 4
  const c = summarize([5, 5]); // sem nota
  const d = summarize([5, 4, 5]); // 4,7 · 3 (igual a "a")
  const e = summarize([5, 4, 5, 5, 4, 5]); // 4,7 · 6
  const sorted = [c, a, b, e, d].sort(compareByRating);
  assert.deepEqual(sorted.map((x) => `${x.avg}/${x.count}`), ['4.8/4', '4.7/6', '4.7/3', '4.7/3', '5/2']);
});
