import { dateKeyOf, dayStartUtc, parseDateKey, todayKey, weekdayOf, addDaysKey } from './booking';
import { DAY_SHORT } from './hours';

/** "Hoje", "Ontem" ou "Seg, 12/10" para o dia (de Brasília) em que o aviso chegou. */
export function dayLabel(key: string, now: Date = new Date()): string {
  const today = todayKey(now);
  if (key === today) return 'Hoje';
  if (key === addDaysKey(today, -1)) return 'Ontem';
  const p = parseDateKey(key);
  if (!p) return key;
  const dd = String(p.d).padStart(2, '0');
  const mm = String(p.m).padStart(2, '0');
  return `${DAY_SHORT[weekdayOf(key)]}, ${dd}/${mm}${p.y !== parseDateKey(today)?.y ? `/${p.y}` : ''}`;
}

/** Agrupa por dia, do mais recente para o mais antigo (a ordem de entrada é mantida dentro de cada dia). */
export function groupByDay<T extends { createdAt: Date }>(items: T[], now: Date = new Date()): { key: string; label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const key = dateKeyOf(it.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, list]) => ({ key, label: dayLabel(key, now), items: list }));
}

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-10" válido ou null (vem da URL, então precisa ser conferido). */
export const parseMonthKey = (v: string | undefined | null): string | null => (v && MONTH_KEY.test(v) ? v : null);

/** "out/2026" para o mês "2026-10". */
export function monthLabel(ym: string): string {
  const m = MONTH_KEY.exec(ym);
  return m ? `${MONTH_SHORT[Number(m[2]) - 1]}/${m[1]}` : ym;
}

/** Início (inclusive) e fim (exclusive) do mês "AAAA-MM" no relógio de Brasília, como instantes UTC. */
export function monthRange(ym: string): { from: Date; to: Date } {
  const m = MONTH_KEY.exec(ym);
  if (!m) throw new Error('Mês inválido.');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  return { from: dayStartUtc(`${ym}-01`), to: dayStartUtc(`${next}-01`) };
}

/** Meses (de Brasília) em que há avisos, do mais recente para o mais antigo, com a quantidade de cada um. */
export function monthsOf(dates: Date[]): { key: string; label: string; count: number }[] {
  const by = new Map<string, number>();
  for (const d of dates) {
    const key = dateKeyOf(d).slice(0, 7);
    by.set(key, (by.get(key) ?? 0) + 1);
  }
  return [...by.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, count]) => ({ key, label: monthLabel(key), count }));
}
