import { dateKeyOf, parseDateKey, todayKey, weekdayOf, addDaysKey } from './booking';
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
