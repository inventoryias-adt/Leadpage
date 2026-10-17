import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leadEmail, leadSchema, leadWhatsapp } from './lead';

const ok = { name: 'Maria Souza', business: 'Café da Maria', phone: '(11) 91234-5678', email: 'Maria@Cafe.com', city: 'São Paulo', state: 'sp', category: 'cafe' };

test('aceita um contato completo e normaliza telefone, e-mail e estado', () => {
  const r = leadSchema.parse({ ...ok, source: 'qr' });
  assert.equal(r.phone, '11912345678');
  assert.equal(r.email, 'maria@cafe.com');
  assert.equal(r.state, 'SP');
  assert.equal(r.source, 'qr');
  assert.equal(r.message, '');
});

test('rejeita telefone, e-mail, ramo e estado inválidos, e cada um com a sua mensagem', () => {
  const msg = (patch: object) => {
    const r = leadSchema.safeParse({ ...ok, ...patch });
    return r.success ? null : r.error.issues[0].message;
  };
  assert.match(msg({ phone: '123' }) ?? '', /telefone com DDD/);
  assert.match(msg({ email: 'maria@' }) ?? '', /e-mail válido/);
  assert.match(msg({ category: 'astronauta' }) ?? '', /ramo/);
  assert.match(msg({ state: 'XX' }) ?? '', /estado válido/);
  assert.match(msg({ name: ' ' }) ?? '', /seu nome/);
  assert.match(msg({ city: '' }) ?? '', /cidade/);
  assert.equal(msg({ state: '' }), null, 'estado é opcional');
});

test('origem desconhecida vira "app"', () => {
  assert.equal(leadSchema.parse({ ...ok, source: 'invasor' }).source, 'app');
});

test('e-mail traz todos os dados, o ramo por extenso e o link do WhatsApp', () => {
  const l = leadSchema.parse({ ...ok, category: 'outros', categoryOther: 'Doceria', message: 'Tenho 2 lojas' });
  const { subject, text } = leadEmail(l, 'https://app/admin/contatos');
  assert.match(subject, /Café da Maria/);
  assert.match(text, /Ramo: Outros · Doceria/);
  assert.match(text, /\(11\) 91234-5678/);
  assert.match(text, /Tenho 2 lojas/);
  assert.match(text, /https:\/\/wa\.me\/5511912345678\?text=/);
  assert.match(text, /https:\/\/app\/admin\/contatos/);
});

test('mensagem do WhatsApp usa o primeiro nome', () => {
  assert.match(decodeURIComponent(leadWhatsapp('11912345678', 'Maria Souza')), /Oi Maria!/);
});
