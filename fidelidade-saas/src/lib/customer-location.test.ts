import assert from 'node:assert/strict';
import test from 'node:test';
import { inBrazil, parseChosen, parseReverse, placeLine, savedText } from './customer-location';

test('coordenadas dentro e fora do Brasil', () => {
  assert.equal(inBrazil(-23.55, -46.63), true);
  assert.equal(inBrazil(-3.1, -60), true);
  assert.equal(inBrazil(40.7, -74), false, 'Nova York');
  assert.equal(inBrazil(0, 0), false);
  assert.equal(inBrazil(NaN, -46), false);
});

test('lê a localização guardada com segurança', () => {
  const ok = JSON.stringify({ kind: 'map', lat: -23.5, lng: -46.6, title: 'Rua A', sub: 'Centro' });
  assert.deepEqual(parseChosen(ok), { kind: 'map', lat: -23.5, lng: -46.6, title: 'Rua A', sub: 'Centro', id: undefined });
  assert.equal(parseChosen(null), null);
  assert.equal(parseChosen('não é json'), null);
  assert.equal(parseChosen(JSON.stringify({ kind: 'x', lat: -23, lng: -46, title: 'a' })), null);
  assert.equal(parseChosen(JSON.stringify({ kind: 'gps', lat: 51, lng: 0, title: 'Londres' })), null, 'fora do Brasil');
  assert.equal(parseChosen(JSON.stringify({ kind: 'gps', lat: -23, lng: -46, title: '' })), null);
  assert.equal(parseChosen(JSON.stringify({ kind: 'gps', lat: '-23', lng: -46, title: 'a' })), null);
});

test('geocodificação reversa do Nominatim → rua, bairro, cidade, UF e CEP', () => {
  const g = parseReverse({ address: { road: 'Rua Ernesta Pelosini', suburb: 'Nova Petrópolis', city: 'São Bernardo do Campo', state: 'São Paulo', 'ISO3166-2-lvl4': 'BR-SP', postcode: '09771-300' } });
  assert.deepEqual(g, { street: 'Rua Ernesta Pelosini', district: 'Nova Petrópolis', city: 'São Bernardo do Campo', state: 'SP', cep: '09771300' });
  assert.equal(parseReverse({ address: { town: 'Cunha', 'ISO3166-2-lvl4': 'BR-SP' } })?.city, 'Cunha');
  assert.equal(parseReverse(null), null);
  assert.equal(parseReverse({}), null);
  assert.equal(placeLine({ street: 'Rua Ernesta Pelosini', district: 'Nova Petrópolis', city: 'SBC' }), 'Rua Ernesta Pelosini · Nova Petrópolis');
  assert.equal(placeLine({ street: '', district: '', city: 'Cunha' }), 'Cunha');
});

test('texto dos endereços salvos', () => {
  assert.deepEqual(savedText({ label: 'CASA', street: 'Rua A', number: '10', district: 'Centro', city: 'SP' }), { title: 'Casa', sub: 'Rua A, 10 · Centro' });
  assert.deepEqual(savedText({ label: 'TRABALHO', street: 'Av B', number: 'S/N', district: null, city: 'Santos' }), { title: 'Trabalho', sub: 'Av B, S/N, Santos' });
});
