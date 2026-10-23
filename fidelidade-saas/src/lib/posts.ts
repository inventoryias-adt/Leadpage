/** Regras das indicações (sem banco, para testar): nota, comentário, @ do Instagram, legenda para o Instagram e limites. */
import { cleanText, displayName, parseRating } from './reviews';

export const POST_COMMENT_MAX = 400;
/** No máximo tantas indicações por cliente a cada 24 horas (evita enxurrada de fotos). */
export const POSTS_PER_DAY = 5;
export const REPORT_REASON_MAX = 300;

export type PostInput = { restaurantId: string; rating: number; comment: string | null };

/** Valida o que o cliente preencheu: lugar, nota de 1 a 5 e comentário opcional (até 400 letras). */
export function parsePost(raw: { restaurantId?: unknown; rating?: unknown; comment?: unknown }): { ok: true; value: PostInput } | { ok: false; error: string } {
  const restaurantId = typeof raw.restaurantId === 'string' ? raw.restaurantId : '';
  if (!/^[0-9a-f-]{36}$/.test(restaurantId)) return { ok: false, error: 'Escolha o lugar da indicação.' };
  const rating = parseRating(raw.rating);
  if (rating == null) return { ok: false, error: 'Dê uma nota de 1 a 5 estrelas.' };
  const comment = cleanText(raw.comment, POST_COMMENT_MAX);
  return { ok: true, value: { restaurantId, rating, comment } };
}

/** "@Maria.Silva", "instagram.com/maria.silva/" ou "maria.silva" → "maria.silva"; vazio → ''; inválido → null. */
export function parseInstagram(raw: unknown): string | '' | null {
  if (typeof raw !== 'string') return null;
  let t = raw.trim();
  if (!t) return '';
  t = t.replace(/^https?:\/\//i, '').replace(/^(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@+/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(t) && !/\.\.|^\.|\.$/.test(t) ? t.toLowerCase() : null;
}

/** Endereço da foto (rota privada; não depende de banco, serve também às telas do navegador). */
export const postPhotoPath = (postId: string) => `/api/indicacoes/foto/${postId}`;

export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`;

/** Legenda pronta para a pessoa publicar no próprio Instagram marcando o lugar. */
export function instagramCaption(p: { placeName: string; placeInstagram?: string | null; rating: number; comment?: string | null }) {
  const tag = p.placeInstagram ? parseInstagram(p.placeInstagram) : null;
  const place = tag ? `@${tag}` : p.placeName;
  const stars = '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating);
  return [`${stars} ${p.placeName}`, p.comment ?? '', `Indicação no Fidelize. ${place} #fidelize`].filter(Boolean).join('\n\n');
}

/** Nome mostrado no feed: primeiro nome e inicial do último ("Maria S."). */
export const authorName = displayName;

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" ou a data. */
export function postAge(at: Date, now: Date = new Date()): string {
  const min = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return at.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
