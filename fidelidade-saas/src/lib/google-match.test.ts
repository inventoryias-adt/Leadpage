import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchClaims, nameMatches, type GoogleReview } from './google-match';

const at = (iso: string) => new Date(iso);
const rev = (id: string, author: string | null, iso: string): GoogleReview => ({ id, author, rating: 5, comment: '', createdAt: at(iso) });

describe('nameMatches', () => {
  it('ignora acento, maiúscula e pontuação', () => {
    assert.equal(nameMatches('José da Silva', 'jose d. silva'), true);
    assert.equal(nameMatches('Lucas Barbosa', 'Lucas B.'), true);
  });
  it('só o primeiro nome de um lado basta', () => {
    assert.equal(nameMatches('Lucas', 'Lucas Barbosa'), true);
    assert.equal(nameMatches('Lucas Barbosa', 'Lucas'), true);
  });
  it('primeiro nome ou inicial do sobrenome diferentes não casam', () => {
    assert.equal(nameMatches('Lucas Barbosa', 'Lucas Souza'), false);
    assert.equal(nameMatches('Lucas Barbosa', 'Mateus Barbosa'), false);
  });
  it('avaliação anônima nunca casa', () => {
    assert.equal(nameMatches('Lucas', null), false);
  });
});

describe('matchClaims', () => {
  const claim = { id: 'c1', customerName: 'Lucas Barbosa', openedAt: at('2026-11-06T15:00:00Z') };
  it('aceita avaliação escrita depois de abrir o Google (com folga de 2 min)', () => {
    assert.equal(matchClaims([claim], [rev('r1', 'Lucas B.', '2026-11-06T15:04:00Z')]).get('c1')?.id, 'r1');
    assert.equal(matchClaims([claim], [rev('r1', 'Lucas B.', '2026-11-06T14:58:30Z')]).get('c1')?.id, 'r1');
  });
  it('recusa avaliação antiga', () => {
    assert.equal(matchClaims([claim], [rev('r1', 'Lucas B.', '2026-10-01T10:00:00Z')]).size, 0);
  });
  it('duas avaliações possíveis para o mesmo pedido: não confirma', () => {
    assert.equal(matchClaims([claim], [rev('r1', 'Lucas B.', '2026-11-06T15:04:00Z'), rev('r2', 'Lucas Barbosa', '2026-11-06T15:06:00Z')]).size, 0);
  });
  it('dois pedidos para a mesma avaliação: não confirma nenhum', () => {
    const other = { id: 'c2', customerName: 'Lucas Bastos', openedAt: at('2026-11-06T15:01:00Z') };
    assert.equal(matchClaims([claim, other], [rev('r1', 'Lucas B.', '2026-11-06T15:04:00Z')]).size, 0);
  });
  it('dois clientes com avaliações diferentes: cada um com a sua', () => {
    const other = { id: 'c2', customerName: 'Ana Lima', openedAt: at('2026-11-06T15:01:00Z') };
    const m = matchClaims([claim, other], [rev('r1', 'Lucas B.', '2026-11-06T15:04:00Z'), rev('r2', 'Ana L.', '2026-11-06T15:05:00Z')]);
    assert.equal(m.get('c1')?.id, 'r1');
    assert.equal(m.get('c2')?.id, 'r2');
  });
});
