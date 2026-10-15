import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canMove, cartCount, cleanCart, hasPromo, isOpen, lineTotal, orderPoints, orderTotal, prepText, promoPct, unitPrice, validPrep } from './orders';

test('cleanCart junta repetidos, limita quantidades e descarta lixo', () => {
  const cart = cleanCart([
    { menuItemId: 'a', qty: 2 },
    { menuItemId: 'a', qty: '3' },
    { menuItemId: 'b', qty: 999 },
    { menuItemId: 'c', qty: 0 },
    { menuItemId: 'd', qty: -4 },
    { menuItemId: '', qty: 1 },
    { qty: 1 },
    null,
    { menuItemId: 'e', qty: 'abc' },
  ]);
  assert.deepEqual(cart, [
    { menuItemId: 'a', qty: 5 },
    { menuItemId: 'b', qty: 20 },
  ]);
  assert.equal(cartCount(cart), 25);
  assert.deepEqual(cleanCart('nada'), []);
  assert.deepEqual(cleanCart(undefined), []);
});

test('preço: usa o promocional só quando vale menos que o cheio', () => {
  assert.equal(unitPrice({ priceCents: 2800, promoCents: 1590 }), 1590);
  assert.equal(unitPrice({ priceCents: 2800, promoCents: null }), 2800);
  assert.equal(unitPrice({ priceCents: 2800, promoCents: 0 }), 2800);
  assert.equal(unitPrice({ priceCents: 2800, promoCents: 2800 }), 2800); // igual ao cheio não é promoção
  assert.equal(unitPrice({ priceCents: 2800, promoCents: 3500 }), 2800); // mais caro que o cheio: ignora
  assert.equal(hasPromo({ priceCents: 2800, promoCents: 1590 }), true);
  assert.equal(hasPromo({ priceCents: 2800, promoCents: null }), false);
  assert.equal(promoPct({ priceCents: 2800, promoCents: 1590 }), 43);
  assert.equal(promoPct({ priceCents: 2800, promoCents: null }), 0);
});

test('total do pedido soma preço de cada unidade vezes a quantidade', () => {
  const acai = { priceCents: 2800, promoCents: 1590 };
  const mascote = { priceCents: 4000, promoCents: null };
  assert.equal(lineTotal(acai, 2), 3180);
  assert.equal(orderTotal([{ item: acai, qty: 2 }, { item: mascote, qty: 1 }]), 7180);
  assert.equal(orderTotal([]), 0);
});

test('pontos do pedido seguem a regra do caixa (arredonda para baixo)', () => {
  assert.equal(orderPoints(1590, 10), 159);
  assert.equal(orderPoints(1599, 3), 47); // R$ 15,99 a 3 pontos por real
  assert.equal(orderPoints(0, 10), 0);
  assert.equal(orderPoints(-50, 10), 0);
});

test('status: o lugar avança ou cancela, nunca reabre um pedido encerrado', () => {
  assert.equal(canMove('RECEIVED', 'PREPARING'), true);
  assert.equal(canMove('RECEIVED', 'PICKED_UP'), true); // entrega na hora
  assert.equal(canMove('PREPARING', 'READY'), true);
  assert.equal(canMove('READY', 'PREPARING'), false); // não volta
  assert.equal(canMove('READY', 'CANCELED'), true);
  assert.equal(canMove('PICKED_UP', 'CANCELED'), false);
  assert.equal(canMove('PICKED_UP', 'READY'), false);
  assert.equal(canMove('CANCELED', 'RECEIVED'), false);
  assert.equal(isOpen('RECEIVED') && isOpen('PREPARING') && isOpen('READY'), true);
  assert.equal(isOpen('PICKED_UP') || isOpen('CANCELED'), false);
});

test('texto do tempo de preparo', () => {
  assert.equal(prepText(15), 'pronto em 15 min');
  assert.equal(prepText(60), 'pronto em 1 h');
  assert.equal(prepText(90), 'pronto em 1 h 30 min');
  assert.equal(validPrep(15), true);
  assert.equal(validPrep(7), false);
});
