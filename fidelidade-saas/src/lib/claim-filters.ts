import type { Prisma } from '@prisma/client';
import { addDaysKey, dayStartUtc, parseDateKey } from './booking';
import { onlyDigits } from './br';
import { PRESETS, presetRange, type Preset } from './redemption-filters';

/** Situação de um lançamento do caixa: creditado (o cliente leu o QR), aguardando leitura ou expirado. */
export const SITUACOES = ['todos', 'creditados', 'aguardando', 'expirados'] as const;
export type Situacao = (typeof SITUACOES)[number];
export const SITUACAO_LABEL: Record<Situacao, string> = { todos: 'Todos', creditados: 'Creditados', aguardando: 'Aguardando leitura', expirados: 'Expirados' };

export type ClaimFilter = { q: string; de: string | null; ate: string | null; sit: Situacao; unid: string | null };
type Raw = { q?: string; de?: string; ate?: string; sit?: string; periodo?: string; unid?: string };

const validKey = (v?: string) => (v && parseDateKey(v) ? v : null);

/** Lê os filtros da URL (o que não vale é ignorado). Datas digitadas valem mais que o atalho de período. */
export function parseClaimFilter(raw: Raw, now: Date = new Date()): ClaimFilter {
  let de = validKey(raw.de);
  let ate = validKey(raw.ate);
  if (!de && !ate && (PRESETS as readonly string[]).includes(raw.periodo ?? '')) ({ de, ate } = presetRange(raw.periodo as Preset, now));
  if (de && ate && de > ate) [de, ate] = [ate, de];
  const sit = (SITUACOES as readonly string[]).includes(raw.sit ?? '') ? (raw.sit as Situacao) : 'todos';
  const unid = raw.unid && /^[0-9a-f-]{36}$/.test(raw.unid) ? raw.unid : null;
  return { q: (raw.q ?? '').trim().slice(0, 60), de, ate, sit, unid };
}

/** Consulta dos lançamentos do estabelecimento: busca por cliente, CPF ou descrição (inclui o valor da compra), data (Brasília), situação e unidade. */
export function buildClaimWhere(restaurantId: string, f: ClaimFilter, now: Date = new Date()): Prisma.ClaimWhereInput {
  const where: Prisma.ClaimWhereInput = { restaurantId };
  if (f.de || f.ate) {
    where.createdAt = {
      ...(f.de ? { gte: dayStartUtc(f.de) } : {}),
      ...(f.ate ? { lt: dayStartUtc(addDaysKey(f.ate, 1)) } : {}),
    };
  }
  if (f.unid) where.unitId = f.unid;
  if (f.sit === 'creditados') where.redeemedAt = { not: null };
  if (f.sit === 'aguardando') Object.assign(where, { redeemedAt: null, expiresAt: { gt: now } });
  if (f.sit === 'expirados') Object.assign(where, { redeemedAt: null, expiresAt: { lte: now } });
  const q = f.q.trim();
  if (q) {
    const digits = onlyDigits(q);
    where.OR = [
      { customer: { name: { contains: q, mode: 'insensitive' } } },
      { description: { contains: q, mode: 'insensitive' } },
      ...(digits.length >= 3 ? [{ customer: { cpf: { contains: digits } } }] : []),
    ];
  }
  return where;
}

/** Os filtros como texto de URL (para links de página e atalhos). */
export function claimQuery(f: ClaimFilter, extra: Record<string, string | null> = {}): string {
  const q = new URLSearchParams();
  if (f.q) q.set('q', f.q);
  if (f.de) q.set('de', f.de);
  if (f.ate) q.set('ate', f.ate);
  if (f.sit !== 'todos') q.set('sit', f.sit);
  if (f.unid) q.set('unid', f.unid);
  for (const [k, v] of Object.entries(extra)) {
    if (v === null) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
