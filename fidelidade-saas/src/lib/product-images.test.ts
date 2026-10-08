import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSearchUrl, cleanBarcode, isAllowedImageUrl, isBarcode, parseProducts } from './product-images';

test('só aceita imagens https dos hosts conhecidos', () => {
  assert.ok(isAllowedImageUrl('https://images.openfoodfacts.org/images/products/789/123/front_pt.4.400.jpg'));
  assert.ok(isAllowedImageUrl('https://static.openfoodfacts.org/images/products/1/front.jpg'));
  for (const bad of [
    'http://images.openfoodfacts.org/images/products/1/front.jpg', // sem https
    'https://evil.com/images/products/1/front.jpg',
    'https://images.openfoodfacts.org.evil.com/images/products/1/front.jpg',
    'https://user:pw@images.openfoodfacts.org/images/products/1/front.jpg',
    'https://images.openfoodfacts.org/outro/caminho.jpg',
    'https://169.254.169.254/images/products/x.jpg',
    'file:///etc/passwd',
    'javascript:alert(1)',
    '',
    'não é url',
  ]) assert.equal(isAllowedImageUrl(bad), false, bad);
});

test('reconhece código de barras e limpa separadores', () => {
  assert.ok(isBarcode('7891000100103'));
  assert.ok(isBarcode('7891000 100103'));
  assert.ok(isBarcode('12345678'));
  assert.equal(isBarcode('1234567'), false);
  assert.equal(isBarcode('coca cola'), false);
  assert.equal(cleanBarcode('789 1000-100.103'), '7891000100103');
});

test('monta a URL por código ou por nome (pt-BR)', () => {
  assert.match(buildSearchUrl('7891000100103'), /\/api\/v2\/product\/7891000100103\.json/);
  const u = buildSearchUrl('guaraná antarctica');
  assert.match(u, /search_terms=guaran%C3%A1\+antarctica/);
  assert.match(u, /cc=br/);
});

test('lê a resposta da busca por nome e por código, ignora o que não tem foto permitida e repetidos', () => {
  const img = (n: number) => `https://images.openfoodfacts.org/images/products/${n}/front_pt.1.400.jpg`;
  const byName = parseProducts({
    products: [
      { code: '1', product_name: 'Guaraná 350 ml', brands: 'Antarctica, Ambev', image_front_url: img(1), image_front_small_url: img(1).replace('.400.', '.200.') },
      { code: '2', product_name: 'Sem foto' },
      { code: '3', product_name: 'Foto de fora', image_front_url: 'https://evil.com/images/products/3.jpg' },
      { code: '4', product_name: 'Repetido', image_front_url: img(1) },
    ],
  });
  assert.equal(byName.length, 1);
  assert.equal(byName[0].name, 'Guaraná 350 ml');
  assert.equal(byName[0].brand, 'Antarctica');
  assert.match(byName[0].thumb, /\.200\./);
  const byCode = parseProducts({ product: { code: '9', image_front_url: img(9) } });
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].name, 'Produto');
  assert.deepEqual(parseProducts(null), []);
  assert.deepEqual(parseProducts({ products: 'x' }), []);
});

import { downloadImageAsDataUrl } from './product-images';

const okUrl = 'https://images.openfoodfacts.org/images/products/789/1/front_pt.1.400.jpg';
const withFetch = async (impl: typeof fetch, fn: () => Promise<void>) => {
  const orig = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    await fn();
  } finally {
    globalThis.fetch = orig;
  }
};
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

test('baixa a imagem permitida e devolve data URL; recusa URL de fora sem nem chamar a rede', async () => {
  let calls = 0;
  await withFetch(async () => (calls++, new Response(png, { headers: { 'content-type': 'image/png' } })), async () => {
    const d = await downloadImageAsDataUrl(okUrl);
    assert.match(d, /^data:image\/png;base64,/);
    await assert.rejects(() => downloadImageAsDataUrl('https://evil.com/images/products/x.jpg'), /não permitida/);
    assert.equal(calls, 1);
  });
});

test('recusa tipo errado, imagem grande demais e resposta com erro', async () => {
  await withFetch(async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }), async () => {
    await assert.rejects(() => downloadImageAsDataUrl(okUrl), /Formato/);
  });
  await withFetch(async () => new Response(Buffer.alloc(460 * 1024), { headers: { 'content-type': 'image/jpeg' } }), async () => {
    await assert.rejects(() => downloadImageAsDataUrl(okUrl), /grande demais/);
  });
  await withFetch(async () => new Response('', { status: 404 }), async () => {
    await assert.rejects(() => downloadImageAsDataUrl(okUrl), /baixar/);
  });
});

test('falha de rede vira mensagem clara em português', async () => {
  await withFetch(async () => { throw new TypeError('fetch failed'); }, async () => {
    await assert.rejects(() => downloadImageAsDataUrl(okUrl), /Não foi possível baixar a imagem/);
  });
});
