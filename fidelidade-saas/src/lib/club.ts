/** Regras do clube de assinatura (sem banco, para testar): validação do plano, ciclos mensais e saldo. */
import { addDaysKey, parseDateKey, todayKey } from './booking';
import { parseMoneyToCents } from './points';
import { cleanText } from './reviews';

export const PLAN_NAME_MAX = 60;
export const PLAN_DESC_MAX = 200;
export const PLAN_MAX_ITEMS = 10;
export const PLAN_MAX_QTY = 99;
export const PLAN_MAX_CENTS = 1_000_000; // R$ 10 mil por mês

export type PlanItemInput = { serviceId: string; quantity: number };
export type PlanInput = { name: string; description: string | null; priceCents: number; items: PlanItemInput[] };

/** Valida o plano que o dono montou: nome, valor mensal e pelo menos um serviço com quantidade por ciclo. */
export function parsePlan(raw: { name?: unknown; description?: unknown; price?: unknown; items?: { serviceId?: unknown; quantity?: unknown }[] }): { ok: true; value: PlanInput } | { ok: false; error: string } {
  const name = String(raw.name ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2) return { ok: false, error: 'Dê um nome ao plano (ex.: Clube do Corte).' };
  if (name.length > PLAN_NAME_MAX) return { ok: false, error: `O nome pode ter até ${PLAN_NAME_MAX} letras.` };
  const priceCents = parseMoneyToCents(String(raw.price ?? ''));
  if (priceCents == null || priceCents <= 0) return { ok: false, error: 'Informe o valor mensal do plano.' };
  if (priceCents > PLAN_MAX_CENTS) return { ok: false, error: 'Valor mensal alto demais. Confira.' };
  const seen = new Set<string>();
  const items: PlanItemInput[] = [];
  for (const it of raw.items ?? []) {
    const serviceId = String(it.serviceId ?? '');
    const quantity = Number(it.quantity);
    if (!serviceId || seen.has(serviceId)) continue;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > PLAN_MAX_QTY) return { ok: false, error: `A quantidade de cada serviço vai de 1 a ${PLAN_MAX_QTY} por mês.` };
    seen.add(serviceId);
    items.push({ serviceId, quantity });
  }
  if (items.length === 0) return { ok: false, error: 'Marque pelo menos um serviço que o plano inclui.' };
  if (items.length > PLAN_MAX_ITEMS) return { ok: false, error: `No máximo ${PLAN_MAX_ITEMS} serviços por plano.` };
  return { ok: true, value: { name, description: cleanText(raw.description, PLAN_DESC_MAX), priceCents, items } };
}

// ---------- ciclos mensais (datas de Brasília como "AAAA-MM-DD") ----------
/** Dia do ciclo: o dia do primeiro pagamento, limitado a 28 para existir em todo mês. */
const cycleDay = (anchor: string) => Math.min(parseDateKey(anchor)!.d, 28);
const ym = (key: string) => { const p = parseDateKey(key)!; return p.y * 12 + (p.m - 1); };
const keyOf = (ymIndex: number, day: number) => `${Math.floor(ymIndex / 12)}-${String((ymIndex % 12) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Número do ciclo (0 = o primeiro) a que uma data pertence; negativo se for antes do início. */
export function periodIndex(anchor: string, date: string): number {
  const months = ym(date) - ym(anchor);
  return parseDateKey(date)!.d < cycleDay(anchor) ? months - 1 : months;
}

/** Início e fim (exclusivo) do ciclo `k`. */
export function periodRange(anchor: string, k: number): { start: string; end: string } {
  const day = cycleDay(anchor);
  return { start: keyOf(ym(anchor) + k, day), end: keyOf(ym(anchor) + k + 1, day) };
}

/** Último dia coberto pelos pagamentos feitos (null se nada foi pago). */
export function coveredUntil(anchor: string | null, paidPeriods: number): string | null {
  if (!anchor || paidPeriods <= 0) return null;
  const { end } = periodRange(anchor, paidPeriods - 1);
  const p = parseDateKey(end)!;
  return new Date(Date.UTC(p.y, p.m - 1, p.d - 1)).toISOString().slice(0, 10);
}

/** A data está dentro de um ciclo já pago? Devolve o número do ciclo, ou null. */
export function coveringPeriod(sub: { anchorDate: string | null; paidPeriods: number }, date: string): number | null {
  if (!sub.anchorDate || sub.paidPeriods <= 0) return null;
  const k = periodIndex(sub.anchorDate, date);
  return k >= 0 && k < sub.paidPeriods ? k : null;
}

/** Dias antes do fim do ciclo pago em que a renovação do mês seguinte já pode ser registrada. */
export const RENEW_WINDOW_DAYS = 7;

/**
 * Pode registrar mais um pagamento agora? Sempre no primeiro e quando o ciclo atual ainda não está pago (vencida); com o ciclo atual
 * pago, só na última semana dele (renovação). Assim um clique repetido não cobra duas vezes nem adianta meses.
 */
export function canRegisterPayment(sub: { anchorDate: string | null; paidPeriods: number }, today: string = todayKey()): boolean {
  if (!sub.anchorDate || sub.paidPeriods <= 0) return true;
  const k = periodIndex(sub.anchorDate, today);
  if (sub.paidPeriods <= k) return true;
  if (sub.paidPeriods === k + 1) return today >= addDaysKey(periodRange(sub.anchorDate, k).end, -RENEW_WINDOW_DAYS);
  return false;
}

export type SubState = 'AWAITING' | 'ACTIVE' | 'DUE' | 'ENDING' | 'ENDED';
/**
 * Em que pé está a assinatura: aguardando o 1º pagamento; em dia; vencida (o ciclo pago acabou e falta renovar);
 * cancelada ainda valendo até o fim do ciclo pago (ENDING); ou encerrada.
 */
export function subscriptionState(sub: { status: string; anchorDate: string | null; paidPeriods: number }, today: string = todayKey()): SubState {
  const until = coveredUntil(sub.anchorDate, sub.paidPeriods);
  if (sub.status === 'CANCELED') return until && until >= today ? 'ENDING' : 'ENDED';
  if (!until) return 'AWAITING';
  return until >= today ? 'ACTIVE' : 'DUE';
}
export const STATE_LABEL: Record<SubState, string> = { AWAITING: 'Aguardando pagamento', ACTIVE: 'Em dia', DUE: 'Vencida', ENDING: 'Cancelada (vale até o fim do ciclo)', ENDED: 'Encerrada' };

export type Balance = { serviceId: string; name: string; quantity: number; used: number; left: number };
/** Saldo do ciclo: quanto cada serviço do plano ainda pode ser usado. */
export function balances(items: { serviceId: string; name: string; quantity: number }[], used: Map<string, number>): Balance[] {
  return items.map((i) => {
    const u = used.get(i.serviceId) ?? 0;
    return { ...i, used: u, left: Math.max(0, i.quantity - u) };
  });
}

/** "3 cortes e 2 barbas" a partir dos itens (nome do serviço + quantidade). */
export const itemsText = (items: { name: string; quantity: number }[]) => items.map((i) => `${i.quantity}× ${i.name}`).join(' · ');
