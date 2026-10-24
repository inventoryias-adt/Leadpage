/**
 * Paleta fixa para dar cor a campanhas e profissionais. O banco guarda só a chave ("azul", "verde"…), nunca um valor livre:
 * assim toda cor combina com a marca e tem contraste bom com texto branco.
 */
export const COLORS = [
  { key: 'azul', label: 'Azul', hex: '#2150C9', soft: '#EAF0FF' },
  { key: 'verde', label: 'Verde', hex: '#15803D', soft: '#E6F7EC' },
  { key: 'laranja', label: 'Laranja', hex: '#C2410C', soft: '#FFEFE3' },
  { key: 'roxo', label: 'Roxo', hex: '#7C3AED', soft: '#F1EAFE' },
  { key: 'rosa', label: 'Rosa', hex: '#BE185D', soft: '#FDE8F2' },
  { key: 'turquesa', label: 'Turquesa', hex: '#0F766E', soft: '#DFF5F1' },
] as const;

export type ColorKey = (typeof COLORS)[number]['key'];
export type ColorInfo = (typeof COLORS)[number];

export const isColorKey = (v: unknown): v is ColorKey => typeof v === 'string' && COLORS.some((c) => c.key === v);

/** A cor da chave; se a chave não existir (ou for vazia), a da posição `fallback` na paleta. */
export function colorOf(key: string | null | undefined, fallback = 0): ColorInfo {
  return COLORS.find((c) => c.key === key) ?? COLORS[((fallback % COLORS.length) + COLORS.length) % COLORS.length];
}

/** Cor padrão de uma campanha do dono que ainda não escolheu: azul para todos, verde para clientes novos, laranja para quem sumiu. */
export const promoDefaultColor = (audience: string): ColorKey => (audience === 'NEW' ? 'verde' : audience === 'INACTIVE' ? 'laranja' : 'azul');

/** Cor da campanha: a escolhida pelo dono ou a padrão pelo público. */
export const promoColor = (p: { color?: string | null; audience: string }): ColorInfo => colorOf(p.color ?? promoDefaultColor(p.audience));

/** Cor de um profissional: a escolhida pelo dono ou, sem escolha, uma da paleta que depende só do id (estável em qualquer tela). */
export function resourceColor(r: { id: string; color?: string | null }): ColorInfo {
  let h = 0;
  for (const ch of r.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return colorOf(r.color, h);
}

/**
 * Cor da marca do estabelecimento (página dele no app do cliente). Lista fechada, como a de cima, para o banco guardar só a chave
 * e para todo botão ter contraste bom com texto branco. "marinho" é o padrão do Fidelize. `deep` fecha o degradê da capa sem foto.
 * Fica separada de COLORS de propósito: mexer em COLORS mudaria as cores automáticas de campanhas e profissionais.
 */
export const BRAND_COLORS = [
  { key: 'marinho', label: 'Marinho', hex: '#0F1F3D', deep: '#1A3FA3' },
  { key: 'azul', label: 'Azul', hex: '#2150C9', deep: '#0F1F3D' },
  { key: 'verde', label: 'Verde', hex: '#15803D', deep: '#0B4A24' },
  { key: 'turquesa', label: 'Turquesa', hex: '#0F766E', deep: '#0A3F3B' },
  { key: 'laranja', label: 'Laranja', hex: '#C2410C', deep: '#7A2A08' },
  { key: 'vinho', label: 'Vinho', hex: '#9F1239', deep: '#5B0A21' },
  { key: 'rosa', label: 'Rosa', hex: '#BE185D', deep: '#6E0E37' },
  { key: 'roxo', label: 'Roxo', hex: '#7C3AED', deep: '#3F1D8A' },
  { key: 'grafite', label: 'Grafite', hex: '#1F2937', deep: '#0B1018' },
] as const;

export type BrandKey = (typeof BRAND_COLORS)[number]['key'];
export const isBrandKey = (v: unknown): v is BrandKey => typeof v === 'string' && BRAND_COLORS.some((c) => c.key === v);
/** A cor da marca escolhida; sem escolha (ou chave desconhecida), o marinho padrão. */
export const brandOf = (key: string | null | undefined) => BRAND_COLORS.find((c) => c.key === key) ?? BRAND_COLORS[0];
export const BRAND_TAGLINE_MAX = 80;
export const BRAND_ABOUT_MAX = 500;
