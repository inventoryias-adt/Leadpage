import { dateKeyOf } from './booking';
import { birthdaysFor } from './birthday';
import { formatBRL, formatPoints, parseMoneyToCents } from './points';

/**
 * Presente do aniversariante: o lugar oferece um item ou benefício no dia do aniversário do cliente.
 * Três jeitos de dar: grátis, trocando por pontos, ou ao consumir um valor mínimo. Regras puras, sem banco.
 */
export const PERK_MODES = ['FREE', 'POINTS', 'SPEND'] as const;
export type PerkMode = (typeof PERK_MODES)[number];
export const PERK_MODE_LABEL: Record<PerkMode, string> = {
  FREE: 'Grátis para o aniversariante',
  POINTS: 'Troca por pontos',
  SPEND: 'Ao consumir um valor mínimo',
};
export const PERK_TITLE_MAX = 60;

export type PerkConfig = { on: boolean; title: string; mode: PerkMode; points: number; minCents: number };

/** O cliente faz aniversário hoje (data de Brasília)? Quem nasceu em 29/02 recebe em 28/02 nos anos não bissextos. */
export function isBirthdayToday(c: { birthDay: number | null; birthMonth: number | null }, now: Date = new Date()): boolean {
  if (c.birthDay == null || c.birthMonth == null) return false;
  const [y, m, d] = dateKeyOf(now).split('-').map(Number);
  return birthdaysFor(d, m, y).some((x) => x.day === c.birthDay && x.month === c.birthMonth);
}

/** Como a regra aparece para o cliente: "grátis", "troca por 300 pontos" ou "ao consumir R$ 50,00 ou mais". */
export function perkCondition(p: { mode: string; points: number; minCents: number }): string {
  if (p.mode === 'POINTS') return `troca por ${formatPoints(p.points)} pontos`;
  if (p.mode === 'SPEND') return `ao consumir ${formatBRL(p.minCents)} ou mais`;
  return 'grátis para o aniversariante';
}

/** Nome que vai no cupom (o balcão lê no voucher): o item e, quando há consumo mínimo, a condição. */
export function perkRewardName(p: { title: string; mode: string; minCents: number }): string {
  return p.mode === 'SPEND' ? `${p.title} (ao consumir ${formatBRL(p.minCents)} ou mais)` : p.title;
}

/** Valida o que o dono preencheu em Regras. Devolve a configuração limpa ou a mensagem para mostrar. */
export function parsePerkConfig(raw: { on?: unknown; title?: unknown; mode?: unknown; points?: unknown; min?: unknown }): { ok: true; value: PerkConfig } | { ok: false; error: string } {
  const on = raw.on === true || raw.on === 'on' || raw.on === 'true';
  const title = String(raw.title ?? '').replace(/\s+/g, ' ').trim().slice(0, PERK_TITLE_MAX);
  const mode = (PERK_MODES as readonly string[]).includes(String(raw.mode)) ? (raw.mode as PerkMode) : 'FREE';
  const points = Math.floor(Number(String(raw.points ?? '').replace(/\D/g, '')) || 0);
  const minCents = parseMoneyToCents(String(raw.min ?? '')) ?? 0;
  if (!on) return { ok: true, value: { on: false, title, mode, points: mode === 'POINTS' ? points : 0, minCents: mode === 'SPEND' ? minCents : 0 } };
  if (!title) return { ok: false, error: 'Diga o que o aniversariante ganha (ex.: Sobremesa grátis).' };
  if (mode === 'POINTS' && (points < 1 || points > 100_000)) return { ok: false, error: 'Informe quantos pontos o aniversariante paga (de 1 a 100.000).' };
  if (mode === 'SPEND' && (minCents < 100 || minCents > 1_000_000)) return { ok: false, error: 'Informe o consumo mínimo em reais (entre R$ 1,00 e R$ 10.000,00).' };
  return { ok: true, value: { on: true, title, mode, points: mode === 'POINTS' ? points : 0, minCents: mode === 'SPEND' ? minCents : 0 } };
}
