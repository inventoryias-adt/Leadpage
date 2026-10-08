import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoryRequestMessage, supportLink } from './support';

test('link do WhatsApp só com número válido', () => {
  assert.equal(supportLink('', 'oi'), null);
  assert.equal(supportLink(undefined, 'oi'), null);
  assert.equal(supportLink('123', 'oi'), null);
  assert.equal(supportLink('+55 (11) 99999-8888', 'olá mundo'), 'https://wa.me/5511999998888?text=ol%C3%A1%20mundo');
});

test('mensagem do pedido de categoria cita o estabelecimento e o que ele é', () => {
  assert.match(categoryRequestMessage('Doce Lar', 'doceria'), /"Doce Lar".*categoria: doceria/);
  assert.doesNotMatch(categoryRequestMessage('Doce Lar', ''), /categoria:/);
});
