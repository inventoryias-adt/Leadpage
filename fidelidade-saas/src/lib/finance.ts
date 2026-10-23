/** Regras da gestão financeira (sem banco, para testar): mês de Brasília, lançamentos fixos, comissão e totais. */
import { addDaysKey, dayStartUtc, parseDateKey, todayKey } from './booking';
import { parseMoneyToCents } from './points';

export const IN_CATEGORIES = ['Venda avulsa', 'Gorjeta', 'Clube de assinatura', 'Outras entradas'] as const;
export const OUT_CATEGORIES = ['Aluguel', 'Salários', 'Comissões', 'Insumos e estoque', 'Energia, água e internet', 'Marketing', 'Impostos e taxas', 'Equipamentos e manutenção', 'Outras despesas'] as const;
export type EntryKind = 'IN' | 'OUT';
export type Recurrence = 'NONE' | 'MONTHLY';
export const DESC_MAX = 80;
export const MAX_ENTRY_CENTS = 100_000_00 * 100; // R$ 10 milhões
export const COMMISSION_MAX_BP = 10_000;

export const categoriesOf = (kind: EntryKind): readonly string[] => (kind === 'IN' ? IN_CATEGORIES : OUT_CATEGORIES);

// ---------- meses (sempre no relógio de Brasília) ----------
export const isMonthKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const monthOf = (dateKey: string) => dateKey.slice(0, 7);
export const currentMonth = (now: Date = new Date()) => monthOf(todayKey(now));
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
/** Primeiro dia do mês, e o primeiro do seguinte, como instantes UTC (meia-noite de Brasília). */
export function monthRange(month: string): { from: Date; to: Date } {
  return { from: dayStartUtc(`${month}-01`), to: dayStartUtc(`${shiftMonth(month, 1)}-01`) };
}
export const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5)) - 1]} de ${month.slice(0, 4)}`;
export const monthShort = (month: string) => MONTHS[Number(month.slice(5)) - 1].slice(0, 3);

// ---------- lançamentos ----------
export type EntryInput = { kind: EntryKind; description: string; category: string; amountCents: number; date: string; recurrence: Recurrence; endsOn: string | null };

/** Valida o que o dono preencheu ao lançar uma entrada ou despesa. */
export function parseEntry(raw: Record<string, unknown>): { ok: true; value: EntryInput } | { ok: false; error: string } {
  const kind = raw.kind === 'IN' ? 'IN' : raw.kind === 'OUT' ? 'OUT' : null;
  if (!kind) return { ok: false, error: 'Escolha se é entrada ou despesa.' };
  const description = String(raw.description ?? '').replace(/\s+/g, ' ').trim();
  if (description.length < 2) return { ok: false, error: 'Descreva o lançamento (ex.: Aluguel da loja).' };
  if (description.length > DESC_MAX) return { ok: false, error: `A descrição pode ter até ${DESC_MAX} letras.` };
  const category = String(raw.category ?? '');
  if (!categoriesOf(kind).includes(category)) return { ok: false, error: 'Escolha uma categoria da lista.' };
  const amountCents = parseMoneyToCents(String(raw.amount ?? ''));
  if (amountCents == null || amountCents <= 0) return { ok: false, error: 'Informe um valor maior que zero.' };
  if (amountCents > MAX_ENTRY_CENTS) return { ok: false, error: 'Valor alto demais. Confira.' };
  const date = String(raw.date ?? '');
  if (!parseDateKey(date)) return { ok: false, error: 'Informe a data do lançamento.' };
  const recurrence: Recurrence = raw.recurrence === 'MONTHLY' ? 'MONTHLY' : 'NONE';
  const endsRaw = String(raw.endsOn ?? '');
  let endsOn: string | null = null;
  if (recurrence === 'MONTHLY' && endsRaw) {
    if (!parseDateKey(endsRaw)) return { ok: false, error: 'Data final inválida.' };
    if (endsRaw < date) return { ok: false, error: 'A data final não pode ser antes do início.' };
    endsOn = endsRaw;
  }
  return { ok: true, value: { kind, description, category, amountCents, date, recurrence, endsOn } };
}

export type EntryRow = { id: string; kind: EntryKind; description: string; category: string; amountCents: number; date: string; recurrence: Recurrence; endsOn: string | null };
export type Occurrence = { id: string; kind: EntryKind; description: string; category: string; amountCents: number; date: string; recurring: boolean };

/**
 * Lançamentos que caem no mês: os avulsos pela data; os mensais a partir do mês de início (e até a data final), no mesmo dia
 * de cada mês, ou no último dia quando o mês é mais curto (dia 31 em fevereiro vira dia 28).
 */
export function occurrencesIn(entries: EntryRow[], month: string): Occurrence[] {
  const last = daysInMonth(month);
  const out: Occurrence[] = [];
  for (const e of entries) {
    if (e.recurrence === 'NONE') {
      if (monthOf(e.date) === month) out.push({ ...e, recurring: false });
      continue;
    }
    if (monthOf(e.date) > month) continue;
    const day = Math.min(Number(e.date.slice(8)), last);
    const date = `${month}-${String(day).padStart(2, '0')}`;
    if (e.endsOn && date > e.endsOn) continue;
    out.push({ ...e, date, recurring: true });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
}

// ---------- comissão ----------
/** "40" ou "12,5" (%) → pontos-base (4000, 1250); vazio → 0; inválido → null. */
export function parseCommission(raw: unknown): number | null {
  const t = String(raw ?? '').replace('%', '').replace(',', '.').trim();
  if (!t) return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp >= 0 && bp <= COMMISSION_MAX_BP ? bp : null;
}
export const commissionLabel = (bp: number) => `${(bp / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
export const commissionOf = (baseCents: number, bp: number) => Math.round((baseCents * bp) / 10_000);

// ---------- totais ----------
export type Totals = { income: number; expense: number; result: number };
export const totals = (income: number, expense: number): Totals => ({ income, expense, result: income - expense });

/** Últimos `n` meses terminando em `month` (do mais antigo ao mais novo). */
export const lastMonths = (month: string, n: number) => Array.from({ length: n }, (_, i) => shiftMonth(month, i - (n - 1)));

/** Primeiro e último dia (AAAA-MM-DD) de um mês. */
export const monthBounds = (month: string) => ({ first: `${month}-01`, last: addDaysKey(`${shiftMonth(month, 1)}-01`, -1) });
