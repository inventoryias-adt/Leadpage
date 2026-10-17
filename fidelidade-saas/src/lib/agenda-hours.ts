import type { Schedule } from './hours';

/** Janela de atendimento do dia, em minutos desde 00:00. Passou da meia-noite (ex.: 18h–2h): `to` passa de 1440. */
export type Window = { from: number; to: number };
/** `'closed'` = fechado nesse dia; `null` = sem horário cadastrado. */
export type DayWindow = Window | 'closed' | null;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function dayWindow(schedule: Schedule | null, weekday: number): DayWindow {
  if (!schedule) return null;
  const d = schedule.find((x) => x.day === weekday);
  if (!d) return null;
  if (d.closed) return 'closed';
  const from = toMin(d.open);
  let to = toMin(d.close);
  if (to <= from) to += 24 * 60;
  return { from, to };
}

/** Une as janelas de várias unidades: do abrir mais cedo ao fechar mais tarde; todas fechadas = fechado. */
export function unionWindow(wins: DayWindow[]): DayWindow {
  const open = wins.filter((w): w is Window => !!w && w !== 'closed');
  if (open.length === 0) return wins.length > 0 && wins.every((w) => w === 'closed') ? 'closed' : null;
  return { from: Math.min(...open.map((w) => w.from)), to: Math.max(...open.map((w) => w.to)) };
}

/**
 * Horas que a grade mostra: o horário de funcionamento (arredondado para a hora cheia), ampliado só se algum agendamento
 * cair fora dele. Sem horário cadastrado, 8h às 18h. Nunca passa de 0h–24h.
 */
export function gridRange(win: DayWindow, bookings: { startMin: number; endMin: number }[]): { startH: number; endH: number } {
  const base: Window = win && win !== 'closed' ? win : win === 'closed' ? { from: 9 * 60, to: 18 * 60 } : { from: 8 * 60, to: 18 * 60 };
  const from = Math.min(base.from, ...bookings.map((b) => b.startMin));
  const to = Math.max(base.to, ...bookings.map((b) => b.endMin));
  return { startH: Math.max(0, Math.floor(from / 60)), endH: Math.min(24, Math.ceil(to / 60)) };
}

/** "9h às 19h", "9h30 às 18h" (passou da meia-noite: "18h às 2h"). */
export function windowLabel(w: Window): string {
  const f = (m: number) => {
    const t = m % 1440;
    const h = Math.floor(t / 60);
    const mm = t % 60;
    return mm === 0 ? `${h}h` : `${h}h${String(mm).padStart(2, '0')}`;
  };
  return `${f(w.from)} às ${f(w.to)}`;
}

/** Trechos da coluna fora do atendimento (para sombrear): antes de abrir, depois de fechar, ou o dia todo se fechado. */
export function offRanges(win: DayWindow, startMin: number, endMin: number): Window[] {
  if (win === 'closed') return [{ from: startMin, to: endMin }];
  if (!win) return [];
  const out: Window[] = [];
  if (win.from > startMin) out.push({ from: startMin, to: Math.min(win.from, endMin) });
  if (win.to < endMin) out.push({ from: Math.max(win.to, startMin), to: endMin });
  return out;
}
