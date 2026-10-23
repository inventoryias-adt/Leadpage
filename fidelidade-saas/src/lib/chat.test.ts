import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHAT_MAX, chatTime, parseMessage, preview, unreadFor } from './chat';

test('parseMessage apara, limita e recusa vazio', () => {
  assert.deepEqual(parseMessage('  Oi,   tudo bem?  '), { ok: true, body: 'Oi, tudo bem?' });
  assert.equal(parseMessage('   ').ok, false);
  assert.equal(parseMessage(undefined).ok, false);
  const long = parseMessage('a'.repeat(CHAT_MAX + 50));
  assert.ok(long.ok && long.body.length === CHAT_MAX);
});

test('unreadFor conta só o que o outro lado mandou depois da última leitura', () => {
  const t = (h: number) => new Date(Date.UTC(2026, 9, 20, h));
  const msgs = [
    { sender: 'CUSTOMER', createdAt: t(10) },
    { sender: 'RESTAURANT', createdAt: t(11) },
    { sender: 'RESTAURANT', createdAt: t(13) },
  ];
  assert.equal(unreadFor('CUSTOMER', msgs, null), 2);
  assert.equal(unreadFor('CUSTOMER', msgs, t(12)), 1);
  assert.equal(unreadFor('CUSTOMER', msgs, t(14)), 0);
  assert.equal(unreadFor('RESTAURANT', msgs, null), 1);
});

test('preview junta linhas e corta com reticências', () => {
  assert.equal(preview('a\n\nb   c'), 'a b c');
  assert.equal(preview('x'.repeat(100), 10), 'xxxxxxxxx…');
});

test('chatTime usa o dia de Brasília', () => {
  const now = new Date('2026-10-23T15:00:00Z'); // sexta 12:00 em Brasília
  assert.equal(chatTime(new Date('2026-10-23T14:32:00Z'), now), '11:32');
  assert.equal(chatTime(new Date('2026-10-22T14:32:00Z'), now), 'ontem 11:32');
  assert.match(chatTime(new Date('2026-10-20T14:32:00Z'), now), /^ter 11:32$/);
  assert.equal(chatTime(new Date('2026-10-02T14:32:00Z'), now), '02/10 11:32');
  // 23h30 de sexta em Brasília, lido no sábado, é "ontem"
  assert.equal(chatTime(new Date('2026-10-24T02:30:00Z'), new Date('2026-10-24T05:00:00Z')), 'ontem 23:30');
});
