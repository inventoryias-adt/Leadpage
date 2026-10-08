/**
 * Busca de fotos de produtos na web (Open Food Facts: gratuito, sem chave, bom para produtos embalados
 * e bebidas) por código de barras ou por nome. O servidor é quem baixa a imagem escolhida, só de hosts
 * conhecidos, para o navegador nunca mandar uma URL arbitrária (SSRF).
 */
const OFF = 'https://world.openfoodfacts.org';
const ALLOWED_HOSTS = new Set(['images.openfoodfacts.org', 'static.openfoodfacts.org']);
const FIELDS = 'code,product_name,brands,image_front_url,image_front_small_url';
export const MAX_REMOTE_BYTES = 450 * 1024;

export type ProductImage = { code: string; name: string; brand: string; thumb: string; image: string };

/** Só https, só hosts do Open Food Facts e só caminhos de imagem de produto. */
export function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password && ALLOWED_HOSTS.has(u.hostname) && u.pathname.startsWith('/images/products/');
  } catch {
    return false;
  }
}

/** 8 a 14 dígitos (EAN-8, UPC, EAN-13, GTIN-14). */
export const isBarcode = (q: string) => /^\d{8,14}$/.test(q.replace(/[\s.-]/g, ''));
export const cleanBarcode = (q: string) => q.replace(/[\s.-]/g, '');

type Raw = { code?: unknown; product_name?: unknown; brands?: unknown; image_front_url?: unknown; image_front_small_url?: unknown };

function toItem(p: Raw): ProductImage | null {
  const image = typeof p.image_front_url === 'string' ? p.image_front_url : '';
  if (!isAllowedImageUrl(image)) return null;
  const small = typeof p.image_front_small_url === 'string' && isAllowedImageUrl(p.image_front_small_url) ? p.image_front_small_url : image;
  return {
    code: typeof p.code === 'string' ? p.code : '',
    name: (typeof p.product_name === 'string' ? p.product_name : '').trim().slice(0, 90) || 'Produto',
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
    if (out.length >= 12) break;
  }
  return out;
}

export function buildSearchUrl(q: string): string {
  if (isBarcode(q)) return `${OFF}/api/v2/product/${cleanBarcode(q)}.json?fields=${FIELDS}`;
  const params = new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '24', lc: 'pt', cc: 'br', fields: FIELDS });
  return `${OFF}/cgi/search.pl?${params}`;
}

export async function searchProductImages(q: string): Promise<ProductImage[]> {
  const res = await fetch(buildSearchUrl(q), {
    headers: { 'User-Agent': 'Fidelize/1.0 (fidelize-nu.vercel.app)', Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Open Food Facts respondeu ${res.status}`);
  return parseProducts(await res.json());
}

/** Baixa a imagem escolhida (host permitido, até 450 KB) e devolve como data URL para o fluxo normal de salvar. */
export async function downloadImageAsDataUrl(url: string): Promise<string> {
  if (!isAllowedImageUrl(url)) throw new Error('Imagem não permitida.');
  const res = await fetch(url, { signal: AbortSignal.timeout(7000), redirect: 'error', cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) throw new Error('Não foi possível baixar a imagem. Escolha outra ou envie a foto do seu computador.');
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Formato de imagem não suportado.');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_REMOTE_BYTES) throw new Error('A imagem encontrada é grande demais. Escolha outra.');
  return `data:${type};base64,${buf.toString('base64')}`;
}
