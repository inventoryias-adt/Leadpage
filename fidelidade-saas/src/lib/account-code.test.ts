import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksLikeAccountCode, normalizeAccountCode } from './account-code';
import { newAccountCode } from './tokens';

test('normaliza o ID digitado de qualquer jeito', () => {
  assert.equal(normalizeAccountCode('fz-7k3q9x'), 'FZ-7K3Q9X');
  assert.equal(normalizeAccountCode(' FZ 7K3Q9X '), 'FZ-7K3Q9X');
  assert.equal(normalizeAccountCode('7k3q9x'), 'FZ-7K3Q9X');
});

test('recusa o que não é um ID', () => {
  assert.equal(normalizeAccountCode('FZ-7K3Q9'), null); // curto
  assert.equal(normalizeAccountCode('FZ-7K3Q9XX'), null); // longo
  assert.equal(normalizeAccountCode('FZ-0K3Q9X'), null); // 0 não existe no alfabeto
  assert.equal(normalizeAccountCode('529.982.247-25'), null); // um CPF
});

test('IDs gerados são válidos e diferentes entre si', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newAccountCode()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.equal(normalizeAccountCode(id), id);
});

test('letras no campo indicam ID; só números indicam CPF', () => {
  assert.equal(looksLikeAccountCode('FZ-7K3Q9X'), true);
  assert.equal(looksLikeAccountCode('529.982.247-25'), false);
});
