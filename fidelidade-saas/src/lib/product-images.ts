/**
 * Busca de fotos de produtos na web, por código de barras ou por nome.
 *  - Imagem preferida: Bluesoft Cosmos (cdn-cosmos.bluesoft.com.br/products/<GTIN>), em geral com fundo branco.
 *  - Nomes → códigos e fotos de reserva: Open Food Facts (gratuito, sem chave).
 * O servidor é quem baixa a imagem escolhida, só de hosts conhecidos, para o navegador nunca mandar
 * uma URL arbitrária (SSRF).
 */
const OFF = 'https://world.openfoodfacts.org';
const COSMOS = 'https://cdn-cosmos.bluesoft.com.br/products';
const ALLOWED: { host: string; prefix: string }[] = [
  { host: 'images.openfoodfacts.org', prefix: '/images/products/' },
  { host: 'static.openfoodfacts.org', prefix: '/images/products/' },
  { host: 'cdn-cosmos.bluesoft.com.br', prefix: '/products/' },
];
const FIELDS = 'code,product_name,brands,quantity,image_front_url,image_front_small_url';
const UA = 'Fidelize/1.0 (fidelize-nu.vercel.app)';
export const MAX_REMOTE_BYTES = 450 * 1024;

export type ProductImage = { code: string; name: string; brand: string; thumb: string; image: string; alt?: string };

/** Só https, só hosts conhecidos e só caminhos de imagem de produto. */
export function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password && ALLOWED.some((a) => a.host === u.hostname && u.pathname.startsWith(a.prefix));
  } catch {
    return false;
  }
}

/** 8 a 14 dígitos (EAN-8, UPC, EAN-13, GTIN-14). */
export const cleanBarcode = (q: string) => q.replace(/[\s.-]/g, '');
export const isBarcode = (q: string) => /^\d{8,14}$/.test(cleanBarcode(q));
export const cosmosImageUrl = (gtin: string) => `${COSMOS}/${gtin}`;

const UNIT: Record<string, string> = { lt: 'l', lts: 'l', litro: 'l', litros: 'l', gr: 'g', grs: 'g', grama: 'g', gramas: 'g', mls: 'ml' };

/** "Coca-Cola  350 ML" → "coca cola 350ml": sem acento, sem hífen e com a medida colada ao número. */
export function normalize(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/(?<!\d)[.,]|[.,](?!\d)/g, ' ')
    .replace(/(\d+(?:[.,]\d+)?)\s*(ml|mls|l|lt|lts|litros?|g|gr|grs|gramas?|kg|mg|un)\b/g, (_m, n: string, u: string) => `${n.replace('.', ',')}${UNIT[u] ?? u}`)
    .replace(/\s+/g, ' ')
    .trim();
}

const SIZE = /\b\d+(?:,\d+)?(?:ml|l|g|kg|mg|un)\b/g;

/** Variações da busca, da mais específica para a mais ampla (a medida costuma atrapalhar quando o cadastro escreve diferente). */
export function queryVariants(q: string): string[] {
  const n = normalize(q);
  const noSize = n.replace(SIZE, '').replace(/\s+/g, ' ').trim();
  const tokens = noSize.split(' ').filter(Boolean);
  const out = [n];
  if (noSize.length >= 3 && noSize !== n) out.push(noSize);
  if (tokens.length > 2) out.push(tokens.slice(0, 2).join(' '));
  return [...new Set(out)].slice(0, 3);
}

/** Quantas palavras da busca aparecem no produto (a medida igual vale mais). Maior = melhor. */
export function score(item: { name: string; brand: string }, query: string): number {
  const hay = normalize(`${item.name} ${item.brand}`);
  const n = normalize(query);
  const words = n.replace(SIZE, '').split(' ').filter((w) => w.length > 1);
  let s = words.filter((w) => hay.includes(w)).length * 2;
  for (const size of n.match(SIZE) ?? []) if (hay.includes(size)) s += 3;
  return s;
}

type Raw = { code?: unknown; product_name?: unknown; brands?: unknown; quantity?: unknown; image_front_url?: unknown; image_front_small_url?: unknown };

function toItem(p: Raw): ProductImage | null {
  const image = typeof p.image_front_url === 'string' ? p.image_front_url : '';
  if (!isAllowedImageUrl(image)) return null;
  const small = typeof p.image_front_small_url === 'string' && isAllowedImageUrl(p.image_front_small_url) ? p.image_front_small_url : image;
  const qty = typeof p.quantity === 'string' ? p.quantity.trim() : '';
  const base = (typeof p.product_name === 'string' ? p.product_name : '').trim();
  const name = (qty && base && !normalize(base).includes(normalize(qty)) ? `${base} ${qty}` : base).slice(0, 90) || 'Produto';
  return {
    code: typeof p.code === 'string' ? p.code : '',
    name,
    brand: (typeof p.brands === 'string' ? p.brands : '').split(',')[0].trim().slice(0, 50),
    thumb: small,
    image,
  };
}

/** Resposta da busca por nome (`products: [...]`) ou por código (`product: {...}`). */
export function parseProducts(json: unknown): ProductImage[] {
  const j = (json ?? {}) as { products?: Raw[]; product?: Raw };
  const list = Array.isArray(j.products) ? j.products : j.product ? [j.product] : [];
  const seen = new Set<string>();
  const out: ProductImage[] = [];
  for (const p of list) {
    const item = toItem(p ?? {});
    if (!item || seen.has(item.image)) continue;
    seen.add(item.image);
    out.push(item);
    if (out.length >= 24) break;
  }
  return out;
}

export function buildSearchUrl(q: string, brazilFirst = false): string {
  if (isBarcode(q)) return `${OFF}/api/v2/product/${cleanBarcode(q)}.json?fields=${FIELDS}`;
  const params = new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '24', lc: 'pt', cc: 'br', fields: FIELDS });
  if (brazilFirst) {
    params.set('tagtype_0', 'countries');
    params.set('tag_contains_0', 'contains');
    params.set('tag_0', 'brazil');
  }
  return `${OFF}/cgi/search.pl?${params}`;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(7000), cache: 'no-store' });
  if (!res.ok) throw new Error(`Open Food Facts respondeu ${res.status}`);
  return res.json();
}

/** A foto da Bluesoft existe para esse código? (HEAD rápido; qualquer falha = não). */
async function cosmosExists(gtin: string): Promise<boolean> {
  try {
    const res = await fetch(cosmosImageUrl(gtin), { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(3500), redirect: 'error', cache: 'no-store' });
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    return res.ok && type.startsWith('image/');
  } catch {
    return false;
  }
}

/** Troca a foto pela da Bluesoft (fundo branco) quando existir; a original vira reserva. */
async function preferCosmos(items: ProductImage[]): Promise<ProductImage[]> {
  return Promise.all(
    items.map(async (it) => {
      if (!isBarcode(it.code) || !(await cosmosExists(cleanBarcode(it.code)))) return it;
      const url = cosmosImageUrl(cleanBarcode(it.code));
      return { ...it, image: url, thumb: url, alt: it.image };
    }),
  );
}

/** Por código de barras: foto da Bluesoft e/ou do Open Food Facts. */
async function searchByBarcode(raw: string): Promise<ProductImage[]> {
  const code = cleanBarcode(raw);
  const [offItems, cosmos] = await Promise.all([getJson(buildSearchUrl(code)).then(parseProducts).catch(() => [] as ProductImage[]), cosmosExists(code)]);
  const off = offItems[0];
  if (cosmos) {
    const url = cosmosImageUrl(code);
    return [{ code, name: off?.name ?? `Código ${code}`, brand: off?.brand ?? '', thumb: url, image: url, alt: off?.image }];
  }
  return off ? [{ ...off, code }] : [];
}

/** Por nome: junta as variações da busca, ordena pelo que mais combina e prefere fotos de fundo branco. */
async function searchByName(q: string): Promise<ProductImage[]> {
  const variants = queryVariants(q);
  const urls = variants.flatMap((v, i) => (i === 0 ? [buildSearchUrl(v, true), buildSearchUrl(v)] : [buildSearchUrl(v, true)]));
  const batches = await Promise.all(urls.map((u) => getJson(u).then(parseProducts).catch(() => [] as ProductImage[])));
  const seen = new Set<string>();
  const merged: ProductImage[] = [];
  for (const it of batches.flat()) {
    const key = it.code || it.image;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(it);
  }
  merged.sort((a, b) => score(b, q) - score(a, q));
  return preferCosmos(merged.slice(0, 12));
}

/** Foto(s) para o produto digitado (nome) ou para o código de barras. Lança erro se todas as fontes falharem. */
export async function searchProductImages(q: string): Promise<ProductImage[]> {
  const term = q.trim();
  return isBarcode(term) ? searchByBarcode(term) : searchByName(term);
}

/** Baixa a imagem escolhida (host permitido, até 450 KB) e devolve como data URL para o fluxo normal de salvar. */
export async function downloadImageAsDataUrl(url: string): Promise<string> {
  if (!isAllowedImageUrl(url)) throw new Error('Imagem não permitida.');
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000), redirect: 'error', cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) throw new Error('Não foi possível baixar a imagem. Escolha outra ou envie a foto do seu computador.');
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Formato de imagem não suportado.');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_REMOTE_BYTES) throw new Error('A imagem encontrada é grande demais. Escolha outra.');
  return `data:${type};base64,${buf.toString('base64')}`;
}

/** Tenta a foto principal e, se falhar, a de reserva. */
export async function downloadWithFallback(primary: string, alt?: string): Promise<string> {
  try {
    return await downloadImageAsDataUrl(primary);
  } catch (e) {
    if (alt && isAllowedImageUrl(alt)) return downloadImageAsDataUrl(alt);
    throw e;
  }
}
