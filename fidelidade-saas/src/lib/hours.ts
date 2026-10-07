import { z } from 'zod';

/** Horário de funcionamento por dia da semana. `day`: 0 = domingo … 6 = sábado. */
export type DaySchedule = { day: number; closed: boolean; open: string; close: string };
export type Schedule = DaySchedule[];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Ordem de exibição: segunda → domingo. */
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function defaultSchedule(): Schedule {
  return Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '11:00', close: '23:00' }));
}

export const scheduleSchema = z
  .array(
    z.object({
      day: z.number().int().min(0).max(6),
      closed: z.boolean(),
      open: z.string().regex(TIME, 'Horário inválido.'),
      close: z.string().regex(TIME, 'Horário inválido.'),
    }),
  )
  .length(7, 'Informe os 7 dias da semana.')
  .superRefine((days, ctx) => {
    if (new Set(days.map((d) => d.day)).size !== 7) ctx.addIssue({ code: 'custom', message: 'Dias repetidos.' });
    for (const d of days) {
      if (!d.closed && d.open === d.close) {
        ctx.addIssue({ code: 'custom', message: `${DAY_NAMES[d.day]}: abertura e fechamento não podem ser iguais.` });
      }
    }
    if (days.every((d) => d.closed)) {
      ctx.addIssue({ code: 'custom', message: 'Deixe ao menos um dia aberto.' });
    }
  });

/** Lê o JSON salvo no banco; devolve null se não houver horário válido. */
export function parseSchedule(value: unknown): Schedule | null {
  const parsed = scheduleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** "11:00" → "11h", "11:30" → "11h30" (como se escreve no Brasil). */
export function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

const range = (d: DaySchedule) => `${fmtTime(d.open)} às ${fmtTime(d.close)}`;

/** Agrupa dias consecutivos (seg→dom) com o mesmo horário: "Seg a Sex: 9h às 23h", "Dom: Fechado". */
export function summarizeSchedule(schedule: Schedule): { label: string; hours: string }[] {
  const byDay = new Map(schedule.map((d) => [d.day, d]));
  const text = (day: number) => {
    const d = byDay.get(day)!;
    return d.closed ? 'Fechado' : range(d);
  };

  const groups: { days: number[]; hours: string }[] = [];
  for (const day of DISPLAY_ORDER) {
    const last = groups[groups.length - 1];
    if (last && last.hours === text(day)) last.days.push(day);
    else groups.push({ days: [day], hours: text(day) });
  }
  return groups.map((g) => {
    const names = g.days.map((d) => DAY_SHORT[d]);
    const label = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} e ${names[1]}` : `${names[0]} a ${names[names.length - 1]}`;
    return { label, hours: g.hours };
  });
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** Está aberto agora? Considera Brasília (UTC−3) e horários que viram a madrugada (ex.: 18h às 02h). */
export function isOpenNow(schedule: Schedule, now: Date = new Date()): boolean {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const day = local.getUTCDay();
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const byDay = new Map(schedule.map((d) => [d.day, d]));

  const today = byDay.get(day);
  if (today && !today.closed) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    if (o < c ? minutes >= o && minutes < c : minutes >= o) return true; // vira a madrugada: aberto até 24h
  }
  const yesterday = byDay.get((day + 6) % 7);
  if (yesterday && !yesterday.closed) {
    const o = toMin(yesterday.open);
    const c = toMin(yesterday.close);
    if (c < o && minutes < c) return true; // sobra de ontem depois da meia-noite
  }
  return false;
}

/** "Hoje: 9h às 23h" ou "Hoje: fechado" (dia da semana em Brasília). */
export function todayLabel(schedule: Schedule, now: Date = new Date()): string {
  const day = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCDay();
  const d = schedule.find((x) => x.day === day);
  if (!d || d.closed) return 'Hoje: fechado';
  return `Hoje: ${fmtTime(d.open)} às ${fmtTime(d.close)}`;
}
