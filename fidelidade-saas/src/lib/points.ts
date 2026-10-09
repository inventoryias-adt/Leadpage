/** Regras de pontuação. Todo cálculo definitivo acontece no servidor com estas funções. */

export const MAX_BILL_CENTS = 10_000_00; // R$ 10.000,00 por lançamento — trava contra erro de digitação
export const CLAIM_TTL_HOURS = 24;

/** "150", "150,5", "1.250,90", "R$ 150.00" → centavos. Retorna null se inválido. */
export function parseMoneyToCents(input: string): number | null {
  let s = input.replace(/[^\d.,]/g, '');
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const sepIndex = Math.max(lastComma, lastDot);

  let intPart = s;
  let decPart = '';
  if (sepIndex !== -1) {
    const after = s.slice(sepIndex + 1);
    // Um único separador seguido de 3 dígitos é separador de milhar ("1.250"), não decimal.
    const isThousands = after.length === 3 && (s.match(/[.,]/g) ?? []).length === 1;
    if (!isThousands) {
      intPart = s.slice(0, sepIndex);
      decPart = after;
    }
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (decPart.length > 2) return null;

  const cents = Number(intPart || '0') * 100 + Number(decPart.padEnd(2, '0') || '0');
  return Number.isFinite(cents) ? cents : null;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Preço de um prêmio: "300 pts" ou, com desconto, "R$ 8,00 + 300 pts". */
export function formatPrice(points: number, cashCents: number): string {
  return cashCents > 0 ? `${formatBRL(cashCents)} + ${formatPoints(points)} pts` : `${formatPoints(points)} pts`;
}

export function formatPoints(points: number): string {
  return points.toLocaleString('pt-BR');
}

export type Interaction = { id: string; label: string; points: number };

/** Pontos = floor(R$ × taxa) + soma das interações marcadas. */
export function calculatePoints(
  amountCents: number,
  pointsPerReal: number,
  interactions: Pick<Interaction, 'points'>[] = [],
): number {
  const fromBill = Math.floor((amountCents * pointsPerReal) / 100);
  return fromBill + interactions.reduce((sum, i) => sum + i.points, 0);
}

/** Início do mês corrente em America/Sao_Paulo (UTC−3, sem horário de verão desde 2019), como Date UTC. */
export function startOfMonthBR(now: Date = new Date()): Date {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3, 0, 0));
}

const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Intervalo [start, end) de um mês em Brasília, a partir de "YYYY-MM" (padrão: mês atual), com navegação. */
export function monthRangeBR(ym?: string | null, now: Date = new Date()) {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  let y = local.getUTCFullYear();
  let m = local.getUTCMonth();
  const match = ym?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (match) {
    y = Number(match[1]);
    m = Number(match[2]) - 1;
  }
  const key = (yy: number, mm: number) => `${yy}-${String(mm + 1).padStart(2, '0')}`;
  const prev = m === 0 ? key(y - 1, 11) : key(y, m - 1);
  const next = m === 11 ? key(y + 1, 0) : key(y, m + 1);
  return {
    start: new Date(Date.UTC(y, m, 1, 3)),
    end: new Date(Date.UTC(y, m + 1, 1, 3)),
    label: `${MONTHS_PT[m]} de ${y}`,
    key: key(y, m),
    prev,
    next,
    isCurrent: key(y, m) === key(local.getUTCFullYear(), local.getUTCMonth()),
  };
}

/** "07/10/2026 às 14:32" em Brasília. */
export function formatDateTimeBR(d: Date): string {
  const date = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const time = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return `${date} às ${time}`;
}
