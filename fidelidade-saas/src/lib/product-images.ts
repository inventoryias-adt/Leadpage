/**
 * Busca de fotos de produtos na web, por código de barras ou por nome.
 *  - Imagem preferida: Bluesoft Cosmos (cdn-cosmos.bluesoft.com.br/products/<GTIN>), em geral com fundo branco.
 *  - API da Bluesoft Cosmos (COSMOS_TOKEN, gratuito): nome ↔ código ↔ foto, base brasileira.
 *  - Open Food Facts (gratuito, sem chave): complemento e reserva.
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

/** Falha de uma fonte: vira aviso na tela em vez de "nenhum resultado". */
export class SourceError extends Error {
  constructor(public source: string, message: string) {
    super(message);
  }
}

async function getJson(source: string, url: string, init: { headers?: Record<string, string>; revalidate?: number; timeout?: number } = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json', ...init.headers },
      signal: AbortSignal.timeout(init.timeout ?? 9000),
      ...(init.revalidate ? { next: { revalidate: init.revalidate } } : { cache: 'no-store' as const }),
    });
  } catch {
    throw new SourceError(source, `${source} não respondeu a tempo`);
  }
  if (res.status === 404) return {};
  if (res.status === 429) throw new SourceError(source, `${source} limitou as buscas por enquanto`);
  if (!res.ok) throw new SourceError(source, `${source} respondeu ${res.status}`);
  return res.json().catch(() => {
    throw new SourceError(source, `${source} devolveu uma resposta inválida`);
  });
}

/** Bluesoft Cosmos (API oficial, exige token gratuito em COSMOS_TOKEN). */
const COSMOS_API = 'https://api.cosmos.bluesoft.com.br';
const cosmosToken = () => (process.env.COSMOS_TOKEN ?? '').trim();
export const hasCosmosApi = () => cosmosToken().length > 0;

type CosmosRaw = { gtin?: unknown; description?: unknown; thumbnail?: unknown; brand?: { name?: unknown } | null };

/** `/gtins/<código>.json` (um produto) ou `/products?query=` (lista) → mesmos cartões da tela. */
export function parseCosmos(json: unknown): ProductImage[] {
  const j = (json ?? {}) as CosmosRaw & { products?: CosmosRaw[] };
  const list = Array.isArray(j.products) ? j.products : j.gtin != null ? [j] : [];
  const out: ProductImage[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    const code = p?.gtin != null ? String(p.gtin).replace(/\D/g, '') : '';
    if (!isBarcode(code)) continue;
    const image = typeof p.thumbnail === 'string' && isAllowedImageUrl(p.thumbnail) ? p.thumbnail : cosmosImageUrl(code);
    if (seen.has(image)) continue;
    seen.add(image);
    out.push({
      code,
      name: (typeof p.description === 'string' ? p.description.trim() : '').slice(0, 90) || `Código ${code}`,
      brand: (typeof p.brand?.name === 'string' ? p.brand.name : '').trim().slice(0, 50),
      thumb: image,
      image,
    });
    if (out.length >= 24) break;
  }
  return out;
}

const cosmosGet = (path: string) =>
  getJson('Bluesoft Cosmos', `${COSMOS_API}${path}`, { headers: { 'X-Cosmos-Token': cosmosToken() }, revalidate: 86400 });

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
      if (it.image.startsWith(COSMOS) || !isBarcode(it.code) || !(await cosmosExists(cleanBarcode(it.code)))) return it;
      const url = cosmosImageUrl(cleanBarcode(it.code));
      return { ...it, image: url, thumb: url, alt: it.image };
    }),
  );
}

export type SearchResult = { items: ProductImage[]; warnings: string[] };

/** Roda uma fonte; se falhar, guarda o aviso e segue com as outras. */
async function attempt(warnings: string[], job: () => Promise<ProductImage[]>): Promise<ProductImage[]> {
  try {
    return await job();
  } catch (e) {
    warnings.push(e instanceof SourceError ? e.message : 'uma das fontes falhou');
    return [];
  }
}

/** Por código de barras: Bluesoft (API e foto) e Open Food Facts. */
async function searchByBarcode(raw: string, warnings: string[]): Promise<ProductImage[]> {
  const code = cleanBarcode(raw);
  const [cosmosItems, offItems, cdn] = await Promise.all([
    hasCosmosApi() ? attempt(warnings, async () => parseCosmos(await cosmosGet(`/gtins/${code}.json`))) : Promise.resolve([] as ProductImage[]),
    attempt(warnings, async () => parseProducts(await getJson('Open Food Facts', buildSearchUrl(code)))),
    cosmosExists(code),
  ]);
  const off = offItems[0];
  const cosmos = cosmosItems[0];
  if (cosmos) return [{ ...cosmos, name: cosmos.name.startsWith('Código ') && off ? off.name : cosmos.name, alt: off?.image }];
  if (cdn) {
    const url = cosmosImageUrl(code);
    return [{ code, name: off?.name ?? `Código ${code}`, brand: off?.brand ?? '', thumb: url, image: url, alt: off?.image }];
  }
  return off ? [{ ...off, code }] : [];
}

/**
 * Por nome: Bluesoft primeiro (base brasileira, fundo branco) e Open Food Facts como complemento.
 * O Open Food Facts limita ~10 buscas/min por IP, então são poucas chamadas, em sequência só se faltar resultado.
 */
async function searchByName(q: string, warnings: string[]): Promise<ProductImage[]> {
  const variants = queryVariants(q);
  const fromCosmos = hasCosmosApi()
    ? await attempt(warnings, async () => {
        const first = parseCosmos(await cosmosGet(`/products?query=${encodeURIComponent(variants[0])}`));
        if (first.length >= 6 || !variants[1]) return first;
        return [...first, ...parseCosmos(await cosmosGet(`/products?query=${encodeURIComponent(variants[1])}`))];
      })
    : [];

  let fromOff: ProductImage[] = [];
  if (fromCosmos.length < 12) {
    fromOff = await attempt(warnings, async () => parseProducts(await getJson('Open Food Facts', buildSearchUrl(variants[0], true))));
    if (fromOff.length < 6) {
      const wider = variants[1] ?? variants[0];
      fromOff = [...fromOff, ...(await attempt(warnings, async () => parseProducts(await getJson('Open Food Facts', buildSearchUrl(wider)))))];
    }
  }

  const seen = new Set<string>();
  const merged: ProductImage[] = [];
  for (const it of [...fromCosmos, ...fromOff]) {
    const key = it.code || it.image;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(it);
  }
  merged.sort((a, b) => score(b, q) - score(a, q));
  return preferCosmos(merged.slice(0, 12));
}

/** Foto(s) para o produto digitado (nome) ou para o código de barras, com avisos das fontes que falharam. */
export async function searchProducts(q: string): Promise<SearchResult> {
  const term = q.trim();
  const warnings: string[] = [];
  const items = isBarcode(term) ? await searchByBarcode(term, warnings) : await searchByName(term, warnings);
  return { items, warnings: [...new Set(warnings)] };
}

/** Só a lista. Lança erro se não achou nada e alguma fonte falhou (para a tela não dizer "não existe"). */
export async function searchProductImages(q: string): Promise<ProductImage[]> {
  const { items, warnings } = await searchProducts(q);
  if (items.length === 0 && warnings.length > 0) throw new Error(warnings.join('; '));
  return items;
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
