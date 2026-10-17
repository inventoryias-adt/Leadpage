import assert from 'node:assert/strict';
import test from 'node:test';
import { noticeKind } from './notice-kind';

test('noticeKind: ícone e cor pelo assunto do aviso', () => {
  assert.equal(noticeKind({ title: 'Seu pedido está pronto' }).icon, 'bag');
  assert.equal(noticeKind({ title: 'Agendamento confirmado' }).icon, 'clock');
  assert.equal(noticeKind({ title: 'Resgate confirmado' }).icon, 'gift');
  assert.equal(noticeKind({ title: 'Você ganhou 940 pontos' }).icon, 'spark');
  assert.equal(noticeKind({ title: 'Novidade' }).icon, 'bell');
});
