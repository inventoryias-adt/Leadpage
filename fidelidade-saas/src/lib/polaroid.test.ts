import assert from 'node:assert/strict';
import test from 'node:test';
import { polaroidFileName, wrapLines } from './polaroid';

const m = (s: string) => s.length * 10; // cada letra mede 10

test('wrapLines quebra por palavras sem passar da largura', () => {
  assert.deepEqual(wrapLines('um dois tres quatro', m, 90, 5), ['um dois', 'tres', 'quatro']);
  assert.deepEqual(wrapLines('  ', m, 90, 3), []);
});

test('wrapLines põe reticências quando o texto passa do limite de linhas', () => {
  const lines = wrapLines('um dois tres quatro cinco seis sete oito', m, 90, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'));
  assert.ok(lines.every((l) => m(l) <= 90));
});

test('wrapLines não põe reticências quando cabe tudo', () => {
  assert.deepEqual(wrapLines('um dois tres', m, 90, 2), ['um dois', 'tres']);
});

test('wrapLines corta uma palavra enorme', () => {
  const lines = wrapLines('abcdefghijklmnopqrstuvwxyz', m, 50, 2);
  assert.ok(lines.length >= 1 && lines.every((l) => m(l) <= 50));
});

test('polaroidFileName tira acentos e símbolos', () => {
  assert.equal(polaroidFileName('Café & Cia. do Zé'), 'fidelize-cafe-cia-do-ze.png');
  assert.equal(polaroidFileName('***'), 'fidelize-indicacao.png');
});
