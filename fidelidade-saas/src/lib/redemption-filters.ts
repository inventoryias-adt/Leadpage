import type { Prisma } from '@prisma/client';
import { addDaysKey, dayStartUtc, parseDateKey, todayKey } from './booking';
import { onlyDigits } from './br';

export const STATUSES = ['pendentes', 'entregues', 'todos'] as const;
export type RedemptionStatusTab = (typeof STATUSES)[number];
export const PRESETS = ['hoje', '7d', 'mes', 'mes-passado'] as const;
export type Preset = (typeof PRESETS)[number];
export const PRESET_LABEL: Record<Preset, string> = { hoje: 'Hoje', '7d': 'Últimos 7 dias', mes: 'Este mês', 'mes-passado': 'Mês passado' };

export type RedemptionFilter = { st: RedemptionStatusTab; q: string; de: string | null; ate: string | null; unid: string | null };
type Raw = { st?: string; q?: string; de?: string; ate?: string; periodo?: string; unid?: string };

const validKey = (v?: string) => (v && parseDateKey(v) ? v : null);

/** Datas (AAAA-MM-DD, Brasília) de cada atalho de período. */
export function presetRange(p: Preset, now: Date = new Date()): { de: string; ate: string } {
  const today = todayKey(now);
  if (p === 'hoje') return { de: today, ate: today };
  if (p === '7d') return { de: addDaysKey(today, -6), ate: today };
  const [y, m] = today.split('-').map(Number);
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  if (p === 'mes') return { de: first(y, m), ate: today };
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return { de: first(py, pm), ate: addDaysKey(first(y, m), -1) };
}

/** Lê os filtros da URL (o que não vale é ignorado). Um atalho de período vira datas; datas digitadas valem mais que o atalho. */
export function parseFilter(raw: Raw, now: Date = new Date()): RedemptionFilter {
  const st = (STATUSES as readonly string[]).includes(raw.st ?? '') ? (raw.st as RedemptionStatusTab) : 'pendentes';
  let de = validKey(raw.de);
  let ate = validKey(raw.ate);
  if (!de && !ate && (PRESETS as readonly string[]).includes(raw.periodo ?? '')) ({ de, ate } = presetRange(raw.periodo as Preset, now));
  if (de && ate && de > ate) [de, ate] = [ate, de];
  const unid = raw.unid && /^[0-9a-f-]{36}$/.test(raw.unid) ? raw.unid : null;
  return { st, q: (raw.q ?? '').trim().slice(0, 60), de, ate, unid };
}

/** Consulta do estabelecimento com os filtros. Entregues usam a data da entrega; os demais, a data do resgate. */
export function buildWhere(restaurantId: string, f: RedemptionFilter): Prisma.RedemptionWhereInput {
  const where: Prisma.RedemptionWhereInput = { restaurantId };
  if (f.st === 'pendentes') where.status = 'PENDING';
  if (f.st === 'entregues') where.status = 'USED';
  const field = f.st === 'entregues' ? 'usedAt' : 'createdAt';
  if (f.de || f.ate) {
    where[field] = {
      ...(f.de ? { gte: dayStartUtc(f.de) } : {}),
      ...(f.ate ? { lt: dayStartUtc(addDaysKey(f.ate, 1)) } : {}),
    };
  }
  if (f.unid) where.usedUnitId = f.unid;
  const q = f.q.trim();
  if (q) {
    const digits = onlyDigits(q);
    where.OR = [
      { code: { contains: q.toUpperCase() } },
      { rewardName: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
      ...(digits.length >= 3 ? [{ customer: { cpf: { contains: digits } } }] : []),
    ];
  }
  return where;
}

/** Os filtros como texto de URL (para links de aba, paginação e exportação). */
export function filterQuery(f: RedemptionFilter, extra: Record<string, string | null> = {}): string {
  const q = new URLSearchParams();
  if (f.st !== 'pendentes') q.set('st', f.st);
  if (f.q) q.set('q', f.q);
  if (f.de) q.set('de', f.de);
  if (f.ate) q.set('ate', f.ate);
  if (f.unid) q.set('unid', f.unid);
  for (const [k, v] of Object.entries(extra)) {
    if (v === null) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
