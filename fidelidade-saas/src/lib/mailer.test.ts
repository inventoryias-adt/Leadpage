import assert from 'node:assert/strict';
import test from 'node:test';
import { pickProvider } from './mail-provider';

test('escolhe o provedor de e-mail: SMTP tem prioridade, depois Resend, senão nenhum', () => {
  assert.equal(pickProvider({}), null);
  assert.equal(pickProvider({ RESEND_API_KEY: 're_x' }), 'resend');
  assert.equal(pickProvider({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@b.c', SMTP_PASS: 'senha' }), 'smtp');
  assert.equal(pickProvider({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@b.c', SMTP_PASS: 'senha', RESEND_API_KEY: 're_x' }), 'smtp');
  assert.equal(pickProvider({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@b.c' }), null, 'SMTP incompleto não vale');
  assert.equal(pickProvider({ SMTP_HOST: ' ', SMTP_USER: ' ', SMTP_PASS: ' ' }), null);
});
