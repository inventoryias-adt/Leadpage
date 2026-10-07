import { formatBRL } from './points';

export type ChallengeLike = {
  kind: 'PURCHASES' | 'CHECKINS';
  target: number;
  minAmountCents: number;
  period: 'WEEK' | 'MONTH';
};

const DAY = 24 * 60 * 60 * 1000;

/** Início/fim [start, end) do período corrente em Brasília e a chave que identifica esse período. */
export function periodRange(period: 'WEEK' | 'MONTH', now: Date = new Date()) {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

  if (period === 'MONTH') {
    const start = Date.UTC(y, m, 1, 3);
    return { start: new Date(start), end: new Date(Date.UTC(y, m + 1, 1, 3)), key: `M${iso(start - 3 * 60 * 60 * 1000).slice(0, 7)}` };
  }
  // Semana de segunda a domingo.
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  const start = Date.UTC(y, m, d - sinceMonday, 3);
  return { start: new Date(start), end: new Date(start + 7 * DAY), key: `W${iso(start - 3 * 60 * 60 * 1000)}` };
}

/** "YYYY-MM-DD" do dia corrente em Brasília (chave do check-in diário). */
export function dayKeyBR(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const times = (n: number) => (n === 1 ? '1 vez' : `${n} vezes`);
const per = (p: 'WEEK' | 'MONTH') => (p === 'WEEK' ? 'na semana' : 'no mês');

/** Frase do desafio para o cliente: "Compre acima de R$ 42,00 · 2 vezes na semana". */
export function describeChallenge(c: ChallengeLike): string {
  if (c.kind === 'CHECKINS') return `Faça check-in ${times(c.target)} ${per(c.period)}`;
  if (c.minAmountCents > 0) return `Compre acima de ${formatBRL(c.minAmountCents)} · ${times(c.target)} ${per(c.period)}`;
  return `Faça ${c.target === 1 ? '1 compra' : `${c.target} compras`} ${per(c.period)}`;
}
