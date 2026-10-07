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
