import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCampaigns } from './campaigns';

const challenge = { id: 'c1', kind: 'PURCHASES' as const, target: 2, minAmountCents: 4200, period: 'WEEK' as const, bonusPoints: 200 };

test('reúne desafios, check-in e indicação', () => {
  const list = buildCampaigns('r1', { challenges: [challenge], checkInPoints: 10, hasCoords: true, referralPoints: 100 });
  assert.deepEqual(list.map((c) => c.kind), ['desafio', 'checkin', 'indicacao']);
  assert.equal(list[0].title.replace(/\u00a0/g, ' '), 'Compre acima de R$ 42,00 · 2 vezes na semana');
  assert.equal(list[0].points, 200);
  assert.equal(list[0].anchor, 'desafios');
});

test('check-in só vira campanha se o lugar tem localização; pontos zero não entram', () => {
  assert.deepEqual(buildCampaigns('r1', { challenges: [], checkInPoints: 10, hasCoords: false, referralPoints: 0 }), []);
  assert.equal(buildCampaigns('r1', { challenges: [], checkInPoints: 0, hasCoords: true, referralPoints: 50 }).length, 1);
});
