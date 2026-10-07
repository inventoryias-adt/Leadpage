import { parseSchedule, summarizeSchedule } from './hours';

/** Texto de horário para vouchers: "Seg a Dom 9h às 23h" (uma unidade) ou "Centro: Seg a Dom 9h às 23h · Shopping: …". */
export function hoursText(units: { name: string; openingSchedule: unknown }[]): string | null {
  const rows = units
    .map((u) => ({ name: u.name, schedule: parseSchedule(u.openingSchedule) }))
    .filter((u): u is { name: string; schedule: NonNullable<ReturnType<typeof parseSchedule>> } => !!u.schedule);
  if (rows.length === 0) return null;
  const fmt = (s: (typeof rows)[number]['schedule']) => summarizeSchedule(s).map((g) => `${g.label} ${g.hours}`).join(' · ');
  return rows.length === 1 ? fmt(rows[0].schedule) : rows.map((r) => `${r.name}: ${fmt(r.schedule)}`).join(' | ');
}
