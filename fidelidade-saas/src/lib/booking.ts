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
export type SlotInput = {
  date: string; // AAAA-MM-DD (Brasília)
  schedule: Schedule | null; // horário de funcionamento da unidade
  durationMin: number;
  resources: { id: string; capacity: number }[];
  busy: BusyRange[]; // agendamentos pendentes/confirmados desses recursos que tocam o dia
  now: Date;
  minNoticeMin: number;
  maxDaysAhead: number;
};
export type Slot = { startsAt: Date; time: string; resourceIds: string[] };

const overlaps = (aStart: number, aEnd: number, b: BusyRange) => aStart < b.endsAt.getTime() && aEnd > b.startsAt.getTime();

/** Horários em que dá para marcar: dentro do expediente, com antecedência, sem estourar a capacidade de nenhum recurso. */
export function availableSlots(input: SlotInput): Slot[] {
  const { date, schedule, durationMin, resources, busy, now, minNoticeMin, maxDaysAhead } = input;
  if (!parseDateKey(date) || !schedule || durationMin <= 0 || resources.length === 0) return [];
  const today = todayKey(now);
  if (date < today || date > addDaysKey(today, maxDaysAhead)) return [];

  const day = schedule.find((d) => d.day === weekdayOf(date));
  if (!day || day.closed) return [];
  const open = toMin(day.open);
  let close = toMin(day.close);
  if (close <= open) close += 24 * 60; // vira a madrugada (ex.: 18h às 02h)

  const base = dayStartUtc(date).getTime();
  const earliest = now.getTime() + minNoticeMin * 60_000;
  const step = slotStep(durationMin);
  const out: Slot[] = [];
  for (let m = open; m + durationMin <= close; m += step) {
    const start = base + m * 60_000;
    if (start < earliest) continue;
    const end = start + durationMin * 60_000;
    const free = resources
      .filter((r) => busy.filter((b) => b.resourceId === r.id && overlaps(start, end, b)).length < r.capacity)
      .map((r) => r.id);
    if (free.length) out.push({ startsAt: new Date(start), time: hmOf(new Date(start)), resourceIds: free });
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
