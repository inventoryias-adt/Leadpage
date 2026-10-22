/** Regras das avaliações (sem banco, para testar): nota de 1 a 5, comentário, prazo, média e nome exibido. */

export const REVIEW_WINDOW_DAYS = 30;
/** A nota do lugar (e de cada profissional) só aparece e entra no ranking a partir de tantas avaliações. */
export const MIN_REVIEWS_FOR_RANK = 3;
export const COMMENT_MAX = 500;

/** Nota válida: número inteiro de 1 a 5. Qualquer outra coisa vira null. */
export function parseRating(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Texto livre limpo: sem espaços sobrando, vazio vira null e corta no limite. */
export function cleanText(v: unknown, max = COMMENT_MAX): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t ? t.slice(0, max) : null;
}

/** Dá para avaliar até 30 dias depois de o atendimento ser concluído. */
export function reviewWindowOpen(completedAt: Date | null | undefined, now = new Date()) {
  if (!completedAt) return false;
  const age = now.getTime() - completedAt.getTime();
  return age >= 0 && age <= REVIEW_WINDOW_DAYS * 24 * 3600e3;
}

export type RatingSummary = { count: number; avg: number | null; ranked: boolean };

/** Média (uma casa) e quantidade. `ranked` só vale com avaliações suficientes: antes disso a nota não aparece. */
export function summarize(ratings: number[]): RatingSummary {
  const valid = ratings.filter((r) => Number.isInteger(r) && r >= 1 && r <= 5);
  if (!valid.length) return { count: 0, avg: null, ranked: false };
  const avg = Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
  return { count: valid.length, avg, ranked: valid.length >= MIN_REVIEWS_FOR_RANK };
}

/** 4,8 (vírgula, como no Brasil). */
export const formatAvg = (avg: number) => avg.toFixed(1).replace('.', ',');

/** "Maria Souza Lima" → "Maria L." (primeiro nome e inicial do último; só o primeiro nome se for um nome só). */
export function displayName(full: string | null | undefined) {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Cliente';
  const first = parts[0].charAt(0).toLocaleUpperCase('pt-BR') + parts[0].slice(1).toLocaleLowerCase('pt-BR');
  if (parts.length === 1) return first;
  return `${first} ${parts[parts.length - 1].charAt(0).toLocaleUpperCase('pt-BR')}.`;
}

/** ★★★★☆ para a nota inteira. */
export const starsText = (n: number) => '★'.repeat(Math.max(0, Math.min(5, Math.round(n)))) + '☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(n))));

/** Ordem de "Mais bem avaliados": quem tem nota válida primeiro (maior média, depois mais avaliações); sem nota vai para o fim. */
export function compareByRating(a: RatingSummary, b: RatingSummary) {
  if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
  if (!a.ranked) return 0;
  return (b.avg ?? 0) - (a.avg ?? 0) || b.count - a.count;
}
