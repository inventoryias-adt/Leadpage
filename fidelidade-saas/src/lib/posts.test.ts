import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorName, instagramCaption, instagramUrl, parseInstagram, parsePost, postAge } from './posts';

const id = '3f2b8c1e-aaaa-4bbb-8ccc-123456789abc';

test('parsePost: lugar, nota de 1 a 5 e comentário limpo', () => {
  assert.deepEqual(parsePost({ restaurantId: id, rating: '5', comment: '  Muito   bom\n\n\n\nvolto  ' }), { ok: true, value: { restaurantId: id, rating: 5, comment: 'Muito bom\n\nvolto' } });
  assert.deepEqual(parsePost({ restaurantId: id, rating: 3, comment: '   ' }), { ok: true, value: { restaurantId: id, rating: 3, comment: null } });
  assert.equal(parsePost({ restaurantId: id, rating: 3, comment: 'a'.repeat(900) }).ok && (parsePost({ restaurantId: id, rating: 3, comment: 'a'.repeat(900) }) as { value: { comment: string } }).value.comment.length, 400);
  assert.match((parsePost({ restaurantId: id, rating: 0 }) as { error: string }).error, /nota/);
  assert.match((parsePost({ restaurantId: id, rating: 6 }) as { error: string }).error, /nota/);
  assert.match((parsePost({ restaurantId: 'x', rating: 4 }) as { error: string }).error, /lugar/);
});

test('parseInstagram aceita @, link e minúsculas; recusa o que não é um @', () => {
  assert.equal(parseInstagram('@Maria.Silva'), 'maria.silva');
  assert.equal(parseInstagram('https://www.instagram.com/maria_silva/?hl=pt'), 'maria_silva');
  assert.equal(parseInstagram('instagram.com/loja.do.ze/'), 'loja.do.ze');
  assert.equal(parseInstagram('  '), '');
  assert.equal(parseInstagram('maria silva'), null);
  assert.equal(parseInstagram('a'.repeat(31)), null);
  assert.equal(parseInstagram('maria..silva'), null);
  assert.equal(parseInstagram('.maria'), null);
  assert.equal(instagramUrl('maria.silva'), 'https://www.instagram.com/maria.silva/');
});

test('instagramCaption marca o @ do lugar quando existe', () => {
  const c = instagramCaption({ placeName: 'Burger do Zé', placeInstagram: '@burgerdoze', rating: 4, comment: 'Smash perfeito' });
  assert.match(c, /^★★★★☆ Burger do Zé/);
  assert.match(c, /Smash perfeito/);
  assert.match(c, /@burgerdoze #fidelize$/);
  assert.match(instagramCaption({ placeName: 'Barbearia X', rating: 5 }), /Barbearia X #fidelize$/);
});

test('authorName e postAge', () => {
  assert.equal(authorName('maria souza lima'), 'Maria L.');
  const now = new Date('2026-10-23T15:00:00Z');
  assert.equal(postAge(new Date('2026-10-23T14:59:40Z'), now), 'agora');
  assert.equal(postAge(new Date('2026-10-23T14:55:00Z'), now), 'há 5 min');
  assert.equal(postAge(new Date('2026-10-23T12:00:00Z'), now), 'há 3 h');
  assert.equal(postAge(new Date('2026-10-22T09:00:00Z'), now), 'ontem');
  assert.equal(postAge(new Date('2026-10-19T09:00:00Z'), now), 'há 4 dias');
  assert.equal(postAge(new Date('2026-10-01T09:00:00Z'), now), '01/10');
});
