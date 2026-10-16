import { calculatePoints } from './points';

/**
 * Regras puras dos pedidos para retirada (sem banco, para testar fácil). Tudo em centavos.
 * O servidor sempre recalcula preço, total e pontos a partir do cardápio — o que vem do navegador é só "quais itens e quantos".
 */

export type OrderStatus = 'RECEIVED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'CANCELED';

export const MAX_QTY_PER_ITEM = 20;
export const MAX_ITEMS_PER_ORDER = 30;
export const MAX_OPEN_ORDERS = 3; // pedidos em aberto por cliente em cada lugar: trava contra pedido em massa
export const MAX_NOTE = 200;

export const OPEN_STATUSES: OrderStatus[] = ['RECEIVED', 'PREPARING', 'READY'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: 'Pedido enviado',
  PREPARING: 'Em preparo',
  READY: 'Pronto para retirar',
  PICKED_UP: 'Retirado',
  CANCELED: 'Cancelado',
};

/** Para onde cada status pode ir. O lugar pode pular etapas (ex.: já entregar), mas nunca reabrir um pedido encerrado. */
const MOVES: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: ['PREPARING', 'READY', 'PICKED_UP', 'CANCELED'],
  PREPARING: ['READY', 'PICKED_UP', 'CANCELED'],
  READY: ['PICKED_UP', 'CANCELED'],
  PICKED_UP: [],
  CANCELED: [],
};

export const canMove = (from: OrderStatus, to: OrderStatus) => MOVES[from].includes(to);
export const isOpen = (s: OrderStatus) => OPEN_STATUSES.includes(s);

export type CartLine = { menuItemId: string; qty: number };

/** Limpa o carrinho que veio do navegador: junta repetidos, descarta lixo e limita as quantidades. */
export function cleanCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, number>();
  for (const it of raw) {
    const id = typeof it?.menuItemId === 'string' ? it.menuItemId : '';
    const qty = Math.floor(Number(it?.qty));
    if (!id || !Number.isFinite(qty) || qty < 1) continue;
    merged.set(id, Math.min(MAX_QTY_PER_ITEM, (merged.get(id) ?? 0) + qty));
  }
  return [...merged].map(([menuItemId, qty]) => ({ menuItemId, qty }));
}

export const cartCount = (lines: { qty: number }[]) => lines.reduce((n, l) => n + l.qty, 0);

type Priced = { priceCents: number; promoCents: number | null; offerEndsAt?: Date | null; offerStock?: number | null };

/**
 * O preço promocional vale só enquanto a oferta está de pé: dentro do prazo (`offerEndsAt`) e com estoque (`offerStock`;
 * null = sem limite). Acabou o prazo ou o estoque, volta ao preço cheio sozinho.
 */
export const promoActive = (i: Priced, now: Date = new Date()) =>
  i.promoCents != null && i.promoCents > 0 && i.promoCents < i.priceCents && (i.offerEndsAt == null || i.offerEndsAt > now) && (i.offerStock == null || i.offerStock > 0);

/** O que se cobra por unidade: o promocional (se a oferta vale) ou o cheio. */
export const unitPrice = (i: Priced, now: Date = new Date()) => (promoActive(i, now) ? (i.promoCents as number) : i.priceCents);
export const hasPromo = (i: Priced, now: Date = new Date()) => promoActive(i, now);
export const lineTotal = (i: Priced, qty: number, now: Date = new Date()) => unitPrice(i, now) * qty;
export const orderTotal = (lines: { item: Priced; qty: number }[], now: Date = new Date()) => lines.reduce((n, l) => n + lineTotal(l.item, l.qty, now), 0);

/** Pontos que o pedido rende quando é retirado (mesma regra do caixa: R$ × pontos por real, arredondando para baixo). */
export const orderPoints = (totalCents: number, pointsPerReal: number) => (totalCents > 0 ? calculatePoints(totalCents, pointsPerReal) : 0);

/** "pronto em 15 min", "pronto em 1 h", "pronto em 1 h 30 min". */
export function prepText(min: number) {
  if (min < 60) return `pronto em ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `pronto em ${h} h${m ? ` ${m} min` : ''}`;
}

/** Tempo de preparo aceito nas configurações: 5 a 240 minutos, em passos de 5. */
export const PREP_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240] as const;
export const validPrep = (n: number) => (PREP_OPTIONS as readonly number[]).includes(n);

/** Percentual de desconto da promoção, para o selo "−43%". */
export const promoPct = (i: Priced, now: Date = new Date()) => (hasPromo(i, now) ? Math.round(((i.priceCents - unitPrice(i, now)) / i.priceCents) * 100) : 0);

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const BR_OFFSET_MS = 3 * 60 * 60 * 1000; // Brasília = UTC−3, sem horário de verão

/** "2026-10-19T23:59" (campo de data e hora, horário de Brasília) → Date; null se vazio ou inválido. */
export function offerEndFromInput(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return null;
  const d = new Date(`${input}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → texto do campo de data e hora em Brasília ("2026-10-19T23:59"). */
export const offerEndToInput = (d: Date) => new Date(d.getTime() - BR_OFFSET_MS).toISOString().slice(0, 16);

/** "até 19 out · 23h59" (horário de Brasília). */
export function offerEndText(d: Date) {
  const br = new Date(d.getTime() - BR_OFFSET_MS);
  const hh = String(br.getUTCHours()).padStart(2, '0');
  const mm = String(br.getUTCMinutes()).padStart(2, '0');
  return `até ${br.getUTCDate()} ${MONTHS[br.getUTCMonth()]} · ${hh}h${mm}`;
}
