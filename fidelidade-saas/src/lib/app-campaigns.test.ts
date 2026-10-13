import assert from 'node:assert/strict';
import test from 'node:test';
import { canAdopt, campaignBadge, campaignLiveNow, campaignWhen, promotionFields, validateCampaign, type AppCampaignLike, type CampaignInput } from './app-campaigns';
import { endOfDayBR, parseTime, startOfDayBR } from './promos';

const base: AppCampaignLike = { id: 'c1', title: 'Terça e quinta em dobro', description: '', kind: 'MULTIPLIER', multiplier: 2, bonusPoints: null, minAmountCents: 0, weekdays: [2, 4], startTime: null, endTime: null, startsAt: null, endsAt: null, active: true };
const money = (v: string) => (/^\d+(,\d{2})?$/.test(v) ? Math.round(Number(v.replace(',', '.')) * 100) : null);
const input = (over: Partial<CampaignInput> = {}): CampaignInput => ({ title: 'Terça em dobro', description: '', kind: 'MULTIPLIER', multiplier: '2', bonusPoints: '', minAmount: '', weekdays: [2, 4], startTime: '', endTime: '', startDate: '', endDate: '', ...over });
const check = (i: CampaignInput) => validateCampaign(i, money, startOfDayBR, endOfDayBR, parseTime);

test('texto e vigência da campanha do app', () => {
  assert.equal(campaignBadge(base), '2x pontos');
  assert.match(campaignWhen(base), /^Ter e qui/);
  assert.equal(campaignLiveNow(base, new Date('2026-10-13T15:00:00Z')), true, 'terça 12h em Brasília');
  assert.equal(campaignLiveNow(base, new Date('2026-10-14T15:00:00Z')), false, 'quarta');
  assert.equal(canAdopt(base), true);
  assert.equal(canAdopt({ ...base, active: false }), false);
  assert.equal(canAdopt({ ...base, endsAt: new Date('2026-10-01T03:00:00Z') }, new Date('2026-10-13T00:00:00Z')), false, 'prazo vencido');
});

test('adotar vira uma promoção comum para todos os clientes', () => {
  const f = promotionFields({ ...base, kind: 'BONUS', multiplier: null, bonusPoints: 50, minAmountCents: 4000 });
  assert.deepEqual([f.kind, f.bonusPoints, f.minAmountCents, f.audience, f.active, f.title], ['BONUS', 50, 4000, 'ALL', true, 'Terça e quinta em dobro']);
});

test('validação do formulário do administrador', () => {
  const ok = check(input());
  assert.ok(ok.ok && ok.data.multiplier === 2 && ok.data.weekdays.join() === '2,4');
  assert.ok(check(input({ title: 'ab' })).ok === false);
  assert.ok(check(input({ multiplier: '1' })).ok === false, 'multiplicador precisa passar de 1');
  assert.ok(check(input({ multiplier: '11' })).ok === false);
  assert.ok(check(input({ multiplier: '1,5' })).ok === true, 'aceita vírgula');
  assert.ok(check(input({ kind: 'BONUS', bonusPoints: '0' })).ok === false);
  const bonus = check(input({ kind: 'BONUS', bonusPoints: '50', minAmount: '40,00' }));
  assert.ok(bonus.ok && bonus.data.bonusPoints === 50 && bonus.data.multiplier === null && bonus.data.minAmountCents === 4000);
  assert.ok(check(input({ startDate: '2026-11-20', endDate: '2026-11-10' })).ok === false, 'fim antes do início');
  assert.ok(check(input({ startTime: '18:00', endTime: '18:00' })).ok === false);
  assert.ok(check(input({ startTime: '25:00' })).ok === false);
  const all7 = check(input({ weekdays: [0, 1, 2, 3, 4, 5, 6] }));
  assert.ok(all7.ok && all7.data.weekdays.length === 0, 'sete dias = todos os dias');
  assert.ok(check(input({ description: 'x'.repeat(301) })).ok === false);
});
