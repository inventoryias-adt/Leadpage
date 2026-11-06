/** Casa pedidos "Já avaliei" com avaliações do Google. Puro (sem banco e sem rede): fácil de testar. */

export type GoogleReview = {
  id: string;
  /** Nome que o autor mostra no Google; vazio quando a avaliação é anônima. */
  author: string | null;
  rating: number;
  comment: string;
  createdAt: Date;
};

export type PendingClaim = { id: string; customerName: string; openedAt: Date };

/** Folga para diferença de relógio entre o celular, o nosso servidor e o Google. */
export const CLOCK_SLACK_MS = 2 * 60_000;

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * O nome do cliente bate com o do autor da avaliação?
 * O Google mostra "Lucas Barbosa" ou "Lucas B.": o primeiro nome precisa ser igual e, se os dois tiverem sobrenome,
 * a inicial do último sobrenome também.
 */
export function nameMatches(customerName: string, author: string | null): boolean {
  if (!author) return false;
  const a = strip(customerName);
  const b = strip(author);
  if (!a.length || !b.length) return false;
  if (a[0] !== b[0]) return false;
  if (a.length === 1 || b.length === 1) return true;
  return a[a.length - 1][0] === b[b.length - 1][0];
}

/**
 * Para cada pedido, a avaliação que o confirma: escrita depois de o cliente abrir o Google e com o nome dele.
 * Se mais de uma avaliação serve a um pedido, ou mais de um pedido serve a uma avaliação, ninguém é confirmado
 * (fica para o dono decidir): melhor não creditar do que creditar a pessoa errada.
 */
export function matchClaims(claims: PendingClaim[], reviews: GoogleReview[]): Map<string, GoogleReview> {
  const candidates = new Map<string, GoogleReview[]>();
  for (const c of claims) {
    const from = c.openedAt.getTime() - CLOCK_SLACK_MS;
    candidates.set(c.id, reviews.filter((r) => r.createdAt.getTime() >= from && nameMatches(c.customerName, r.author)));
  }
  const usedBy = new Map<string, number>();
  for (const list of candidates.values()) for (const r of list) usedBy.set(r.id, (usedBy.get(r.id) ?? 0) + 1);
  const out = new Map<string, GoogleReview>();
  for (const [claimId, list] of candidates) {
    if (list.length === 1 && usedBy.get(list[0].id) === 1) out.set(claimId, list[0]);
  }
  return out;
}
