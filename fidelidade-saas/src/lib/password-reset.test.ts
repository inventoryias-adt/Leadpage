import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KIND_SEGMENT, hashResetToken, looksLikeToken, newResetToken, resetEmailText, segmentKind } from './password-reset';

test('token novo é único, tem formato esperado e o hash não revela o token', () => {
  const a = newResetToken();
  const b = newResetToken();
  assert.notEqual(a, b);
  assert.ok(looksLikeToken(a));
  assert.equal(hashResetToken(a), hashResetToken(a));
  assert.notEqual(hashResetToken(a), hashResetToken(b));
  assert.ok(!hashResetToken(a).includes(a));
  assert.equal(looksLikeToken('curto'), false);
  assert.equal(looksLikeToken(`${a}x`), false);
  assert.equal(looksLikeToken('../../etc/passwd'.padEnd(43, 'a')), false);
});

test('segmentos da URL ↔ tipo', () => {
  assert.equal(segmentKind('cliente'), 'customer');
  assert.equal(segmentKind('dono'), 'restaurant');
  assert.equal(segmentKind('admin'), null);
  assert.equal(KIND_SEGMENT.customer, 'cliente');
});

test('o e-mail traz o primeiro nome, o link e o aviso de segurança', () => {
  const t = resetEmailText('Maria Souza', 'https://fidelize.test/redefinir/cliente/abc');
  assert.match(t, /Olá, Maria!/);
  assert.match(t, /https:\/\/fidelize\.test\/redefinir\/cliente\/abc/);
  assert.match(t, /1 hora/);
  assert.match(t, /Se não foi você/);
});
