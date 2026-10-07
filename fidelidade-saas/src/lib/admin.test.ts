import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminPasswordIssue, hashInviteToken, newInvite, tempPassword } from './admin-pure';

test('regra de senha do administrador', () => {
  assert.match(adminPasswordIssue('curta1') ?? '', /10 caracteres/);
  assert.match(adminPasswordIssue('somenteletrasaqui') ?? '', /letras e números/);
  assert.match(adminPasswordIssue('1234567890123') ?? '', /letras e números/);
  assert.equal(adminPasswordIssue('senhaboa2026x'), null);
  assert.match(adminPasswordIssue('a1'.repeat(40)) ?? '', /no máximo/);
});

test('convite: o banco guarda só o hash, que bate com o token', () => {
  const a = newInvite();
  const b = newInvite();
  assert.notEqual(a.token, b.token);
  assert.equal(hashInviteToken(a.token), a.tokenHash);
  assert.notEqual(a.tokenHash, a.token);
  assert.ok(a.token.length >= 32);
  const hours = (a.expiresAt.getTime() - Date.now()) / 3_600_000;
  assert.ok(hours > 47 && hours <= 48);
});

test('senha temporária: 12 caracteres legíveis e diferentes a cada vez', () => {
  const p = tempPassword();
  assert.match(p, /^[a-zA-Z2-9]{12}$/);
  assert.ok(!/[0O1lI]/.test(p));
  assert.notEqual(p, tempPassword());
});
