import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { hashPassword, verifyPassword } from './password';

test('scrypt: gera e verifica', async () => {
  const h = await hashPassword('senha-segura-1');
  assert.ok(h.startsWith('scrypt$'));
  assert.equal(await verifyPassword('senha-segura-1', h), true);
  assert.equal(await verifyPassword('senha-errada', h), false);
  assert.notEqual(await hashPassword('senha-segura-1'), h); // sal aleatório
});

test('aceita hashes bcrypt antigos', async () => {
  const legacy = await bcrypt.hash('antiga-123', 4);
  assert.equal(await verifyPassword('antiga-123', legacy), true);
  assert.equal(await verifyPassword('outra', legacy), false);
});

test('formato desconhecido nunca autentica', async () => {
  assert.equal(await verifyPassword('x', 'texto-solto'), false);
});
