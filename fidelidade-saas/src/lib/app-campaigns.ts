/** Campanhas do app: a plataforma propõe, cada estabelecimento adota. Regras puras (sem banco). */
import { formatBRL } from './points';
import { promoActiveAt, promoBadge, promoStatus, promoWhen, type PromoKind, type PromoLike, type PromoStatus } from './promos';

export type AppCampaignLike = {
  id: string;
  title: string;
  description: string;
  kind: PromoKind;
  multiplier: number | null;
  bonusPoints: number | null;
  minAmountCents: number;
  weekdays: number[];
  startTime: string | null;
  endTime: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
};

/** A campanha vista como promoção comum (público: todos), para reaproveitar texto e regras de horário. */
export const asPromo = (c: AppCampaignLike): PromoLike => ({
  title: c.title, kind: c.kind, multiplier: c.multiplier, bonusPoints: c.bonusPoints, minAmountCents: c.minAmountCents,
  startsAt: c.startsAt, endsAt: c.endsAt, weekdays: c.weekdays, startTime: c.startTime, endTime: c.endTime,
  audience: 'ALL', inactiveDays: null, active: c.active,
});

export const campaignBadge = (c: AppCampaignLike) => promoBadge(c);
export const campaignWhen = (c: AppCampaignLike) => promoWhen(asPromo(c), formatBRL);
export const campaignStatus = (c: AppCampaignLike, now: Date = new Date()): PromoStatus => promoStatus(asPromo(c), now);
export const campaignLiveNow = (c: AppCampaignLike, now: Date = new Date()) => promoActiveAt(asPromo(c), now);

/** Ainda dá para um estabelecimento adotar? (ativa e sem prazo vencido) */
export const canAdopt = (c: AppCampaignLike, now: Date = new Date()) => c.active && !(c.endsAt && now >= c.endsAt);

/** Campos da Promotion que o estabelecimento ganha ao adotar (e que se mantêm em dia quando a campanha muda). */
export function promotionFields(c: AppCampaignLike) {
  return {
    title: c.title,
    kind: c.kind,
    multiplier: c.multiplier,
    bonusPoints: c.bonusPoints,
    minAmountCents: c.minAmountCents,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    weekdays: c.weekdays,
    startTime: c.startTime,
    endTime: c.endTime,
    audience: 'ALL' as const,
    inactiveDays: null,
    active: c.active,
  };
}

export type CampaignInput = {
  title: string;
  description: string;
  kind: PromoKind;
  multiplier: string;
  bonusPoints: string;
  minAmount: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
};

/** Confere o formulário do administrador. Devolve os campos prontos para gravar ou a mensagem de erro. */
export function validateCampaign(i: CampaignInput, parseMoney: (v: string) => number | null, dayStart: (ymd: string) => Date | null, dayEnd: (ymd: string) => Date | null, parseTime: (t: string) => number | null):
  | { ok: true; data: Omit<AppCampaignLike, 'id' | 'active'> }
  | { ok: false; error: string } {
  const title = i.title.trim();
  if (title.length < 3 || title.length > 80) return { ok: false, error: 'O título precisa ter entre 3 e 80 caracteres.' };
  const description = i.description.trim();
  if (description.length > 300) return { ok: false, error: 'A descrição pode ter até 300 caracteres.' };

  let multiplier: number | null = null;
  let bonusPoints: number | null = null;
  if (i.kind === 'MULTIPLIER') {
    multiplier = Number(i.multiplier.replace(',', '.'));
    if (!Number.isFinite(multiplier) || multiplier <= 1 || multiplier > 10) return { ok: false, error: 'O multiplicador precisa ficar entre 1,1 e 10 (ex.: 2 para pontos em dobro).' };
  } else {
    bonusPoints = Number(i.bonusPoints);
    if (!Number.isInteger(bonusPoints) || bonusPoints < 1 || bonusPoints > 10_000) return { ok: false, error: 'Os pontos extras precisam ser um número inteiro entre 1 e 10.000.' };
  }

  let minAmountCents = 0;
  if (i.minAmount.trim()) {
    const cents = parseMoney(i.minAmount);
    if (cents === null || cents > 1_000_000) return { ok: false, error: 'Valor mínimo inválido. Exemplo: 40,00' };
    minAmountCents = cents;
  }

  const startsAt = i.startDate ? dayStart(i.startDate) : null;
  const endsAt = i.endDate ? dayEnd(i.endDate) : null;
  if ((i.startDate && !startsAt) || (i.endDate && !endsAt)) return { ok: false, error: 'Data inválida.' };
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, error: 'A data final precisa ser igual ou depois da inicial.' };
  if ((i.startTime && parseTime(i.startTime) == null) || (i.endTime && parseTime(i.endTime) == null)) return { ok: false, error: 'Horário inválido.' };
  if (i.startTime && i.endTime && i.startTime === i.endTime) return { ok: false, error: 'O horário inicial e o final não podem ser iguais.' };

  const weekdays = [...new Set(i.weekdays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
  return {
    ok: true,
    data: { title, description, kind: i.kind, multiplier, bonusPoints, minAmountCents, startsAt, endsAt, weekdays: weekdays.length === 7 ? [] : weekdays, startTime: i.startTime || null, endTime: i.endTime || null },
  };
}
