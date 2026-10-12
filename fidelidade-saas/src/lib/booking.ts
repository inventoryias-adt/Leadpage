import type { Schedule } from './hours';

/**
 * Agenda: datas e horários em Brasília (UTC−3, sem horário de verão desde 2019) e cálculo dos horários livres.
 * Tudo aqui é puro (sem banco), para ser testado; quem consulta o banco monta a entrada e chama `availableSlots`.
 */
const BRT_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-12" válido (dia que existe no calendário) ou null. */
export function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const m = KEY.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d ? { y, m: mo, d } : null;
}

/** Meia-noite de Brasília daquele dia, como instante UTC. */
export function dayStartUtc(key: string): Date {
  const p = parseDateKey(key);
  if (!p) throw new Error('Data inválida.');
  return new Date(Date.UTC(p.y, p.m - 1, p.d) + BRT_MS);
}

/** Dia da semana (0 = domingo) da data de Brasília. */
export function weekdayOf(key: string): number {
  const p = parseDateKey(key);
  if (!p) throw new Error('Data inválida.');
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** "AAAA-MM-DD" de um instante, no relógio de Brasília. */
export function dateKeyOf(at: Date): string {
  return new Date(at.getTime() - BRT_MS).toISOString().slice(0, 10);
}

export const todayKey = (now: Date = new Date()) => dateKeyOf(now);

export function addDaysKey(key: string, days: number): string {
  return dateKeyOf(new Date(dayStartUtc(key).getTime() + days * DAY_MS + 12 * 60 * 60 * 1000));
}

/** "09:30" no relógio de Brasília. */
export function hmOf(at: Date): string {
  return new Date(at.getTime() - BRT_MS).toISOString().slice(11, 16);
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** De quanto em quanto tempo os horários aparecem: de meia em meia hora (serviços muito curtos: 15 min). */
export const slotStep = (durationMin: number) => (durationMin < 30 ? 15 : 30);

export type BusyRange = { resourceId: string | null; startsAt: Date; endsAt: Date };
export type SlotResource = {
  id: string;
  capacity: number;
  /** Quanto leva com este profissional (vazio = a duração padrão da entrada). */
  durationMin?: number;
  /** Dias e horários em que ele trabalha (vazio = segue o horário da unidade). */
  schedule?: Schedule | null;
};
export type SlotInput = {
  date: string; // AAAA-MM-DD (Brasília)
  schedule: Schedule | null; // horário de funcionamento da unidade
  durationMin: number; // duração padrão do serviço
  resources: SlotResource[];
  busy: BusyRange[]; // agendamentos pendentes/confirmados desses recursos que tocam o dia
  now: Date;
  minNoticeMin: number;
  maxDaysAhead: number;
};
export type Slot = { startsAt: Date; time: string; resourceIds: string[]; durationByResource: Record<string, number> };

const overlaps = (aStart: number, aEnd: number, b: BusyRange) => aStart < b.endsAt.getTime() && aEnd > b.startsAt.getTime();

/** Janela de trabalho do dia em minutos desde a meia-noite (fecha depois da meia-noite = passa de 1440), ou null se não trabalha. */
function windowOf(schedule: Schedule, weekday: number): { open: number; close: number } | null {
  const d = schedule.find((x) => x.day === weekday);
  if (!d || d.closed) return null;
  const open = toMin(d.open);
  let close = toMin(d.close);
  if (close <= open) close += 24 * 60;
  return { open, close };
}

/**
 * Horários em que dá para marcar: dentro do expediente da unidade E da escala do profissional, com antecedência,
 * respeitando a duração de cada um e sem estourar a capacidade de nenhum recurso.
 */
export function availableSlots(input: SlotInput): Slot[] {
  const { date, schedule, durationMin, resources, busy, now, minNoticeMin, maxDaysAhead } = input;
  if (!parseDateKey(date) || !schedule || durationMin <= 0 || resources.length === 0) return [];
  const today = todayKey(now);
  if (date < today || date > addDaysKey(today, maxDaysAhead)) return [];

  const weekday = weekdayOf(date);
  const unit = windowOf(schedule, weekday);
  if (!unit) return [];

  // Janela de cada profissional naquele dia: a interseção da escala dele com a da unidade.
  const staff = resources
    .map((r) => {
      const own = r.schedule ? windowOf(r.schedule, weekday) : unit;
      if (!own) return null;
      const win = { open: Math.max(unit.open, own.open), close: Math.min(unit.close, own.close) };
      const dur = r.durationMin && r.durationMin > 0 ? r.durationMin : durationMin;
      return win.close - win.open >= dur ? { r, win, dur } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (staff.length === 0) return [];

  const base = dayStartUtc(date).getTime();
  const earliest = now.getTime() + minNoticeMin * 60_000;
  const step = slotStep(Math.min(...staff.map((x) => x.dur)));
  const first = Math.min(...staff.map((x) => x.win.open));
  const last = Math.max(...staff.map((x) => x.win.close));
  const out: Slot[] = [];
  for (let m = first; m < last; m += step) {
    const start = base + m * 60_000;
    if (start < earliest) continue;
    const free: string[] = [];
    const durs: Record<string, number> = {};
    for (const { r, win, dur } of staff) {
      if (m < win.open || m + dur > win.close) continue;
      const end = start + dur * 60_000;
      if (busy.filter((b) => b.resourceId === r.id && overlaps(start, end, b)).length >= r.capacity) continue;
      free.push(r.id);
      durs[r.id] = dur;
    }
    if (free.length) out.push({ startsAt: new Date(start), time: hmOf(new Date(start)), resourceIds: free, durationByResource: durs });
  }
  return out;
}

/** Entre os livres, o que tem menos agendamentos no dia (distribui o trabalho); empate: ordem do id. */
export function pickResource(freeIds: string[], busy: BusyRange[]): string | null {
  if (freeIds.length === 0) return null;
  const load = (id: string) => busy.filter((b) => b.resourceId === id).length;
  return [...freeIds].sort((a, b) => load(a) - load(b) || a.localeCompare(b))[0];
}

/** O cliente ainda pode cancelar sozinho? (até `cancelHours` antes do horário marcado) */
export function canCustomerCancel(b: { status: string; startsAt: Date }, cancelHours: number, now: Date = new Date()): boolean {
  if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') return false;
  return b.startsAt.getTime() - now.getTime() >= cancelHours * 3_600_000;
}

/** Lembrete "está tudo certo?": sai quando faltam entre 5 e 30 minutos (a verificação roda a cada ~5 min). */
export const REMINDER_LEAD_MIN = 30;
export const REMINDER_MIN_AHEAD_MIN = 5;

/**
 * Este agendamento está na hora de receber o lembrete? Só confirmados, ainda não lembrados, dentro da janela,
 * e que já existiam antes da janela começar (quem agenda em cima da hora não precisa de lembrete).
 */
export function reminderDue(b: { status: string; startsAt: Date; createdAt: Date; reminderSentAt: Date | null }, now: Date = new Date()): boolean {
  if (b.status !== 'CONFIRMED' || b.reminderSentAt) return false;
  const ahead = b.startsAt.getTime() - now.getTime();
  if (ahead < REMINDER_MIN_AHEAD_MIN * 60_000 || ahead > REMINDER_LEAD_MIN * 60_000) return false;
  return b.createdAt.getTime() <= b.startsAt.getTime() - REMINDER_LEAD_MIN * 60_000;
}

/** Pontos de um atendimento concluído: o valor do serviço vezes a taxa do estabelecimento (mesma regra do caixa). */
export const bookingPoints = (priceCents: number, pointsPerReal: number) => Math.floor((priceCents * pointsPerReal) / 100);

/** "Seg, 12/10 às 14h30" para exibir. */
export function formatBookingWhen(at: Date): string {
  const local = new Date(at.getTime() - BRT_MS);
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const [h, m] = hmOf(at).split(':');
  const hora = m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
  return `${dias[local.getUTCDay()]}, ${String(local.getUTCDate()).padStart(2, '0')}/${String(local.getUTCMonth() + 1).padStart(2, '0')} às ${hora}`;
}
