/** Campanhas de pontos criadas pelo dono: multiplicador ("2x") ou pontos extras, por período, dia da semana e horário (Brasília). */

export type PromoKind = 'MULTIPLIER' | 'BONUS';

export type PromoLike = {
  title: string;
  kind: PromoKind;
  multiplier: number | null;
  bonusPoints: number | null;
  minAmountCents: number;
  startsAt: Date | null;
  endsAt: Date | null; // exclusivo
  weekdays: number[]; // 0 = domingo … 6 = sábado; vazio = todos os dias
  startTime: string | null; // "HH:MM"
  endTime: string | null;
  active: boolean;
};

const BRT_OFFSET = 3 * 60 * 60 * 1000;

/** Dia da semana e minutos desde a meia-noite, em Brasília. */
function brt(now: Date) {
  const local = new Date(now.getTime() - BRT_OFFSET);
  return { dow: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

export function parseTime(t: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(t ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

/** "2026-11-10" → 00:00 desse dia em Brasília (como Date UTC). */
export function startOfDayBR(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 3));
}

/** "2026-11-20" → início do dia seguinte em Brasília (limite exclusivo que inclui o dia inteiro). */
export function endOfDayBR(ymd: string): Date | null {
  const s = startOfDayBR(ymd);
  return s ? new Date(s.getTime() + 24 * 60 * 60 * 1000) : null;
}

/** Está dentro do dia e do horário combinados? (ignora período e pausa) */
function inSlot(p: PromoLike, now: Date) {
  const { dow, minutes } = brt(now);
  if (p.weekdays.length > 0 && !p.weekdays.includes(dow)) return false;
  const s = parseTime(p.startTime);
  const e = parseTime(p.endTime);
  if (s != null && e != null) return s <= e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
  if (s != null) return minutes >= s;
  if (e != null) return minutes < e;
  return true;
}

const inPeriod = (p: PromoLike, now: Date) => (!p.startsAt || now >= p.startsAt) && (!p.endsAt || now < p.endsAt);

/** A campanha vale neste instante? */
export function promoActiveAt(p: PromoLike, now: Date = new Date()): boolean {
  return p.active && inPeriod(p, now) && inSlot(p, now);
}

export type PromoStatus = 'now' | 'scheduled' | 'ended' | 'paused';

export function promoStatus(p: PromoLike, now: Date = new Date()): PromoStatus {
  if (p.endsAt && now >= p.endsAt) return 'ended';
  if (!p.active) return 'paused';
  return promoActiveAt(p, now) ? 'now' : 'scheduled';
}

/**
 * Aplica as campanhas valendo agora à parte da conta: o maior multiplicador (não acumulam entre si)
 * e a soma dos pontos extras. Cada campanha só vale se a conta atinge o seu mínimo.
 */
export function applyPromos<P extends PromoLike>(billPoints: number, amountCents: number, promos: P[], now: Date = new Date()) {
  const live = promos.filter((p) => promoActiveAt(p, now) && amountCents >= p.minAmountCents);
  const multipliers = live.filter((p) => p.kind === 'MULTIPLIER' && (p.multiplier ?? 1) > 1);
  const best = multipliers.reduce<P | null>((a, p) => (!a || (p.multiplier ?? 1) > (a.multiplier ?? 1) ? p : a), null);
  const bonuses = live.filter((p) => p.kind === 'BONUS' && (p.bonusPoints ?? 0) > 0);
  const points = Math.round(billPoints * (best?.multiplier ?? 1)) + bonuses.reduce((n, p) => n + (p.bonusPoints ?? 0), 0);
  return { points, applied: [...(best ? [best] : []), ...bonuses] };
}

const DAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function weekdaysText(days: number[]): string {
  const list = [...new Set(days)].sort((a, b) => a - b);
  if (list.length === 0 || list.length === 7) return 'todos os dias';
  const names = list.map((d) => DAYS_SHORT[d]);
  return names.length === 1 ? DAYS[list[0]] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

const ddmm = (d: Date) => {
  const l = new Date(d.getTime() - BRT_OFFSET);
  return `${String(l.getUTCDate()).padStart(2, '0')}/${String(l.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** "2x pontos" ou "+50 pontos". */
export function promoBadge(p: Pick<PromoLike, 'kind' | 'multiplier' | 'bonusPoints'>): string {
  if (p.kind === 'MULTIPLIER') return `${String(p.multiplier ?? 1).replace('.', ',')}x pontos`;
  return `+${p.bonusPoints ?? 0} pontos`;
}

/** "Terça e quinta, das 18h às 22h, de 10/11 a 20/11, em compras a partir de R$ 40,00". */
export function promoWhen(p: PromoLike, formatMoney: (cents: number) => string): string {
  const parts: string[] = [];
  parts.push(p.weekdays.length === 0 || p.weekdays.length === 7 ? 'Todos os dias' : weekdaysText(p.weekdays).replace(/^./, (c) => c.toUpperCase()));
  const s = parseTime(p.startTime);
  const e = parseTime(p.endTime);
  const hh = (m: number) => (m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
  if (s != null && e != null) parts.push(`das ${hh(s)} às ${hh(e)}`);
  else if (s != null) parts.push(`a partir das ${hh(s)}`);
  else if (e != null) parts.push(`até as ${hh(e)}`);
  if (p.startsAt && p.endsAt) parts.push(`de ${ddmm(p.startsAt)} a ${ddmm(new Date(p.endsAt.getTime() - 1))}`);
  else if (p.startsAt) parts.push(`a partir de ${ddmm(p.startsAt)}`);
  else if (p.endsAt) parts.push(`até ${ddmm(new Date(p.endsAt.getTime() - 1))}`);
  if (p.minAmountCents > 0) parts.push(`em compras a partir de ${formatMoney(p.minAmountCents)}`);
  return parts.join(', ');
}
