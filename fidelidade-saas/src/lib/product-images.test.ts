import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSearchUrl, cleanBarcode, cosmosImageUrl, isAllowedImageUrl, isBarcode, normalize, parseProducts, parseCosmos, queryVariants, score, searchProductImages, searchProducts } from './product-images';

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

test('aceita a foto da Bluesoft só no caminho de produtos', () => {
  assert.ok(isAllowedImageUrl(cosmosImageUrl('7894900011517')));
  assert.equal(isAllowedImageUrl('https://cdn-cosmos.bluesoft.com.br/outra/coisa.jpg'), false);
  assert.equal(isAllowedImageUrl('http://cdn-cosmos.bluesoft.com.br/products/789'), false);
});

test('normaliza o que o dono digita: acento, hífen e medida colada', () => {
  assert.equal(normalize('Coca-Cola  350 ML'), 'coca cola 350ml');
  assert.equal(normalize('Guaraná Antárctica 2 Litros'), 'guarana antarctica 2l');
  assert.equal(normalize('Leite 1,5 L'), 'leite 1,5l');
  assert.equal(normalize('Água sem gás 500ml.'), 'agua sem gas 500ml');
});

test('variações da busca: completa, sem a medida e as duas primeiras palavras', () => {
  assert.deepEqual(queryVariants('Coca-Cola 350 ml'), ['coca cola 350ml', 'coca cola']);
  assert.deepEqual(queryVariants('Biscoito Recheado Chocolate Nestlé 140g'), ['biscoito recheado chocolate nestle 140g', 'biscoito recheado chocolate nestle', 'biscoito recheado']);
  assert.deepEqual(queryVariants('pizza'), ['pizza']);
});

test('ordena pelo que mais combina, com a medida igual valendo mais', () => {
  const a = { name: 'Coca-Cola Zero 350 ml', brand: 'Coca-Cola' };
  const b = { name: 'Coca-Cola Original 2 L', brand: 'Coca-Cola' };
  const c = { name: 'Guaraná 350 ml', brand: 'Antarctica' };
  assert.ok(score(b, 'Coca-Cola 350 ml') < score(a, 'Coca-Cola 350 ml'));
  assert.ok(score(c, 'Coca-Cola 350 ml') < score(b, 'Coca-Cola 350 ml'));
});

test('por código de barras: usa a foto da Bluesoft quando existe e o nome do Open Food Facts', async () => {
  const orig = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.startsWith('https://cdn-cosmos.bluesoft.com.br/')) return new Response('', { headers: { 'content-type': 'image/jpeg' } });
    return Response.json({ product: { code: '7894900011517', product_name: 'Coca-Cola', quantity: '350 ml', brands: 'Coca-Cola', image_front_url: 'https://images.openfoodfacts.org/images/products/789/490/001/1517/front_pt.1.400.jpg' } });
  }) as typeof fetch;
  try {
    const r = await searchProductImages('789 4900011517');
    assert.equal(r.length, 1);
    assert.equal(r[0].image, cosmosImageUrl('7894900011517'));
    assert.match(r[0].alt ?? '', /openfoodfacts/);
    assert.equal(r[0].name, 'Coca-Cola 350 ml');
    assert.ok(calls.some((c) => c.startsWith('HEAD https://cdn-cosmos')));
  } finally {
    globalThis.fetch = orig;
  }
});

test('por código sem foto da Bluesoft cai para o Open Food Facts; sem nenhuma, devolve vazio', async () => {
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string) =>
      url.startsWith('https://cdn-cosmos') ? new Response('', { status: 404 }) : Response.json({ product: { code: '7891000100103', product_name: 'Leite', image_front_url: 'https://images.openfoodfacts.org/images/products/789/1/front_pt.1.400.jpg' } })) as typeof fetch;
    const r = await searchProductImages('7891000100103');
    assert.equal(r.length, 1);
    assert.match(r[0].image, /openfoodfacts/);
    globalThis.fetch = (async (url: string) => (url.startsWith('https://cdn-cosmos') ? new Response('', { status: 404 }) : Response.json({ status: 0 }))) as typeof fetch;
    assert.deepEqual(await searchProductImages('7891000100103'), []);
  } finally {
    globalThis.fetch = orig;
  }
});

test('por nome: junta as variações, ordena e troca pela foto da Bluesoft quando existe', async () => {
  const orig = globalThis.fetch;
  const img = (n: number) => `https://images.openfoodfacts.org/images/products/${n}/front_pt.1.400.jpg`;
  globalThis.fetch = (async (url: string) => {
    if (url.startsWith('https://cdn-cosmos')) return url.endsWith('/7894900011517') ? new Response('', { headers: { 'content-type': 'image/png' } }) : new Response('', { status: 404 });
    const q = new URL(url).searchParams.get('search_terms');
    return Response.json({
      products: q === 'coca cola 350ml'
        ? [{ code: '7894900011517', product_name: 'Coca-Cola', quantity: '350 ml', brands: 'Coca-Cola', image_front_url: img(1) }]
        : [
            { code: '7894900011517', product_name: 'Coca-Cola', quantity: '350 ml', brands: 'Coca-Cola', image_front_url: img(1) },
            { code: '7894900027013', product_name: 'Coca-Cola', quantity: '2 L', brands: 'Coca-Cola', image_front_url: img(2) },
          ],
    });
  }) as typeof fetch;
  try {
    const r = await searchProductImages('Coca-Cola 350 ml');
    assert.equal(r.length, 2, 'sem repetir o mesmo código');
    assert.equal(r[0].name, 'Coca-Cola 350 ml');
    assert.equal(r[0].image, cosmosImageUrl('7894900011517'));
    assert.match(r[1].image, /openfoodfacts/);
  } finally {
    globalThis.fetch = orig;
  }
});

test('lê a resposta da API da Bluesoft (um produto e lista)', () => {
  const one = parseCosmos({ gtin: 7891000100103, description: 'LEITE UHT INTEGRAL 1L', thumbnail: 'https://cdn-cosmos.bluesoft.com.br/products/7891000100103', brand: { name: 'Italac' } });
  assert.equal(one.length, 1);
  assert.equal(one[0].code, '7891000100103');
  assert.equal(one[0].brand, 'Italac');
  const list = parseCosmos({ products: [{ gtin: 7894900011517, description: 'Refrigerante', thumbnail: 'https://evil.example/x.jpg' }, { gtin: 'abc' }] });
  assert.equal(list.length, 1, 'ignora código inválido');
  assert.equal(list[0].image, cosmosImageUrl('7894900011517'), 'thumbnail de host estranho vira a foto da Bluesoft');
  assert.deepEqual(parseCosmos({}), []);
});

test('com COSMOS_TOKEN: busca por nome e por código usa a API da Bluesoft com o token', async () => {
  const orig = globalThis.fetch;
  process.env.COSMOS_TOKEN = 'tok-teste';
  const seen: { url: string; token?: string }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (url.startsWith('https://api.cosmos.bluesoft.com.br')) {
      seen.push({ url, token: headers['X-Cosmos-Token'] });
      if (url.includes('/gtins/')) return Response.json({ gtin: 7891000100103, description: 'LEITE UHT 1L', thumbnail: cosmosImageUrl('7891000100103'), brand: { name: 'Italac' } });
      return Response.json({ products: Array.from({ length: 12 }, (_, i) => ({ gtin: 7890000000000 + i * 7, description: `AGUA MINERAL ${i}`, thumbnail: cosmosImageUrl(String(7890000000000 + i * 7)) })) });
    }
    if (url.startsWith('https://cdn-cosmos')) return new Response('', { status: 404 });
    return Response.json({});
  }) as typeof fetch;
  try {
    const byName = await searchProducts('água');
    assert.equal(byName.items.length, 12);
    assert.deepEqual(byName.warnings, []);
    const byCode = await searchProducts('7891000100103');
    assert.equal(byCode.items[0].name, 'LEITE UHT 1L');
    assert.ok(seen.length >= 2 && seen.every((c) => c.token === 'tok-teste'));
  } finally {
    delete process.env.COSMOS_TOKEN;
    globalThis.fetch = orig;
  }
});

test('falha de fonte aparece como aviso/erro, não como "nenhum resultado"', async () => {
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string) => (url.startsWith('https://cdn-cosmos') ? new Response('', { status: 404 }) : new Response('', { status: 503 }))) as typeof fetch;
    const r = await searchProducts('água');
    assert.equal(r.items.length, 0);
    assert.match(r.warnings.join(' '), /Open Food Facts respondeu 503/);
    await assert.rejects(() => searchProductImages('água'), /Open Food Facts/);
    globalThis.fetch = (async (url: string) => (url.startsWith('https://cdn-cosmos') ? new Response('', { status: 404 }) : new Response('', { status: 429 }))) as typeof fetch;
    assert.match((await searchProducts('7891000100103')).warnings.join(' '), /limitou/);
  } finally {
    globalThis.fetch = orig;
  }
});
