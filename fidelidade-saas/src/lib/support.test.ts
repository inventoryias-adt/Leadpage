import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSupport, categoryRequestMessage, mailtoLink, supportLink } from './support';

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

test('mailto com assunto e texto prontos; e-mail inválido ou vazio = indisponível', () => {
  assert.equal(mailtoLink('', 'a', 'b'), null);
  assert.equal(mailtoLink('sem-arroba', 'a', 'b'), null);
  assert.equal(mailtoLink(' suporte@exemplo.com.br ', 'Ajuda no Fidelize', 'Olá, preciso de ajuda'), 'mailto:suporte@exemplo.com.br?subject=Ajuda%20no%20Fidelize&body=Ol%C3%A1%2C%20preciso%20de%20ajuda');
});

test('contatos do suporte: e-mail é o principal e o WhatsApp complementa; qualquer um pode faltar', () => {
  const both = buildSupport({ email: 'suporte@x.com', whatsapp: '5511975944834' }, 'Assunto', 'Mensagem');
  assert.equal(both.email, 'suporte@x.com');
  assert.match(both.emailHref ?? '', /^mailto:suporte@x\.com\?subject=Assunto/);
  assert.match(both.whatsappHref ?? '', /^https:\/\/wa\.me\/5511975944834\?text=Mensagem/);
  const onlyWhats = buildSupport({ email: '', whatsapp: '5511975944834' }, 'a', 'b');
  assert.equal(onlyWhats.emailHref, null);
  assert.ok(onlyWhats.whatsappHref);
  assert.deepEqual(buildSupport({}, 'a', 'b'), { email: null, emailHref: null, whatsappHref: null });
});
