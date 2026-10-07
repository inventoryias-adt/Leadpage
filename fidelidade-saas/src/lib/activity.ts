/** Pontos do cliente ao longo do tempo (gráfico do perfil). Tudo em horário de Brasília. */
import { brtParts } from './insights';

const DAY = 24 * 60 * 60 * 1000;

export const PERIODS = ['hoje', 'ontem', 'semana', 'mes'] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<Period, string> = { hoje: 'Hoje', ontem: 'Ontem', semana: 'Essa semana', mes: 'Esse mês' };

export type Movement = { at: Date; type: 'EARN' | 'REDEEM'; points: number };
export type Slot = { label: string; earned: number; redeemed: number; total: number };
export type Activity = { slots: Slot[]; earned: number; redeemed: number; earnCount: number; redeemCount: number };

/** Início (em Brasília) do dia `ymd` deslocado `back` dias. */
const shiftYmd = (ymd: string, back: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) - back * DAY).toISOString().slice(0, 10);

/** Janela de busca: o mês corrente cobre qualquer período (hoje, ontem, 7 dias ou mês), com folga de 8 dias. */
export function activitySince(now: Date = new Date()): Date {
  const today = brtParts(now).ymd;
  const monthStart = `${today.slice(0, 8)}01`;
  const from = shiftYmd(today, 8) < monthStart ? shiftYmd(today, 8) : monthStart;
  return new Date(Date.parse(`${from}T03:00:00Z`)); // 00:00 em Brasília
}

/**
 * Hoje/Ontem: uma coluna por hora. Semana: os últimos 7 dias. Mês: do dia 1 até hoje.
 * `total` é o acumulado de pontos ganhos até aquela coluna (a linha do gráfico).
 */
export function activitySeries(rows: Movement[], period: Period, now: Date = new Date()): Activity {
  const today = brtParts(now).ymd;
  const nowHour = brtParts(now).hour;
  const slots: Slot[] = [];
  const index = new Map<string, Slot>();
  const add = (key: string, label: string) => {
    const s: Slot = { label, earned: 0, redeemed: 0, total: 0 };
    slots.push(s);
    index.set(key, s);
  };

  if (period === 'hoje' || period === 'ontem') {
    const day = period === 'hoje' ? today : shiftYmd(today, 1);
    const last = period === 'hoje' ? nowHour : 23;
    for (let h = 0; h <= last; h++) add(`${day}|${h}`, `${String(h).padStart(2, '0')}h`);
  } else {
    const days = period === 'semana' ? 7 : Number(today.slice(8, 10));
    for (let i = days - 1; i >= 0; i--) {
      const ymd = shiftYmd(today, i);
      add(ymd, `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`);
    }
  }

  let earned = 0;
  let redeemed = 0;
  let earnCount = 0;
  let redeemCount = 0;
  for (const r of rows) {
    const p = brtParts(r.at);
    const slot = index.get(period === 'hoje' || period === 'ontem' ? `${p.ymd}|${p.hour}` : p.ymd);
    if (!slot) continue;
    if (r.type === 'EARN') {
      slot.earned += r.points;
      earned += r.points;
      earnCount += 1;
    } else {
      slot.redeemed += r.points;
      redeemed += r.points;
      redeemCount += 1;
    }
  }
  let run = 0;
  for (const s of slots) {
    run += s.earned;
    s.total = run;
  }
  return { slots, earned, redeemed, earnCount, redeemCount };
}
