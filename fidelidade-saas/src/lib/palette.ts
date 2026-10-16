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
