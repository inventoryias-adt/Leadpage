import assert from 'node:assert/strict';
import { test } from 'node:test';
import { balances, canRegisterPayment, coveredUntil, coveringPeriod, parsePlan, periodIndex, periodRange, subscriptionState } from './club';

test('parsePlan valida nome, valor e itens', () => {
  const ok = parsePlan({ name: '  Clube   do Corte ', description: 'Para quem vem sempre', price: '149,90', items: [{ serviceId: 's1', quantity: '3' }, { serviceId: 's2', quantity: 2 }, { serviceId: 's1', quantity: 9 }] });
  assert.deepEqual(ok, { ok: true, value: { name: 'Clube do Corte', description: 'Para quem vem sempre', priceCents: 14990, items: [{ serviceId: 's1', quantity: 3 }, { serviceId: 's2', quantity: 2 }] } });
  const bad = (o: object) => parsePlan({ name: 'Plano', price: '10', items: [{ serviceId: 's1', quantity: 1 }], ...o });
  assert.equal(bad({ name: 'a' }).ok, false);
  assert.equal(bad({ price: '0' }).ok, false);
  assert.equal(bad({ price: '99999' }).ok, false);
  assert.equal(bad({ items: [] }).ok, false);
  assert.equal(bad({ items: [{ serviceId: 's1', quantity: 0 }] }).ok, false);
  assert.equal(bad({ items: [{ serviceId: 's1', quantity: 100 }] }).ok, false);
  assert.equal(bad({ items: [{ serviceId: 's1', quantity: 1.5 }] }).ok, false);
});

test('ciclos mensais: índice, limites e dia 29 a 31', () => {
  assert.equal(periodIndex('2026-10-10', '2026-10-10'), 0);
  assert.equal(periodIndex('2026-10-10', '2026-11-09'), 0);
  assert.equal(periodIndex('2026-10-10', '2026-11-10'), 1);
  assert.equal(periodIndex('2026-10-10', '2027-01-09'), 2);
  assert.equal(periodIndex('2026-10-10', '2026-10-09'), -1); // antes de começar
  assert.deepEqual(periodRange('2026-10-10', 0), { start: '2026-10-10', end: '2026-11-10' });
  assert.deepEqual(periodRange('2026-12-10', 1), { start: '2027-01-10', end: '2027-02-10' });
  // começou no dia 31: o ciclo passa a ser dia 28, que existe em todo mês
  assert.deepEqual(periodRange('2026-01-31', 0), { start: '2026-01-28', end: '2026-02-28' });
  assert.equal(periodIndex('2026-01-31', '2026-02-27'), 0);
  assert.equal(periodIndex('2026-01-31', '2026-02-28'), 1);
});

test('cobertura pelos pagamentos feitos', () => {
  assert.equal(coveredUntil('2026-10-10', 1), '2026-11-09');
  assert.equal(coveredUntil('2026-10-10', 3), '2027-01-09');
  assert.equal(coveredUntil(null, 0), null);
  const sub = { anchorDate: '2026-10-10', paidPeriods: 2 };
  assert.equal(coveringPeriod(sub, '2026-10-15'), 0);
  assert.equal(coveringPeriod(sub, '2026-11-15'), 1);
  assert.equal(coveringPeriod(sub, '2026-12-10'), null); // terceiro ciclo não pago
  assert.equal(coveringPeriod(sub, '2026-10-09'), null); // antes do início
  assert.equal(coveringPeriod({ anchorDate: null, paidPeriods: 0 }, '2026-10-15'), null);
});

test('subscriptionState', () => {
  const t = '2026-11-20';
  assert.equal(subscriptionState({ status: 'ACTIVE', anchorDate: null, paidPeriods: 0 }, t), 'AWAITING');
  assert.equal(subscriptionState({ status: 'ACTIVE', anchorDate: '2026-11-10', paidPeriods: 1 }, t), 'ACTIVE');
  assert.equal(subscriptionState({ status: 'ACTIVE', anchorDate: '2026-10-10', paidPeriods: 1 }, t), 'DUE'); // coberto até 09/11
  assert.equal(subscriptionState({ status: 'CANCELED', anchorDate: '2026-11-10', paidPeriods: 1 }, t), 'ENDING');
  assert.equal(subscriptionState({ status: 'CANCELED', anchorDate: '2026-10-10', paidPeriods: 1 }, t), 'ENDED');
  assert.equal(subscriptionState({ status: 'CANCELED', anchorDate: null, paidPeriods: 0 }, t), 'ENDED');
});

test('balances', () => {
  const b = balances([{ serviceId: 'c', name: 'Corte', quantity: 3 }, { serviceId: 'b', name: 'Barba', quantity: 2 }], new Map([['c', 3], ['b', 1]]));
  assert.deepEqual(b.map((x) => `${x.name}:${x.left}`), ['Corte:0', 'Barba:1']);
  assert.equal(balances([{ serviceId: 'c', name: 'Corte', quantity: 1 }], new Map([['c', 5]]))[0].left, 0);
});

test('canRegisterPayment: primeiro sempre; vencida sempre; renovação só na última semana do ciclo pago', () => {
  const sub = (paidPeriods: number) => ({ anchorDate: '2026-10-10', paidPeriods });
  assert.equal(canRegisterPayment({ anchorDate: null, paidPeriods: 0 }, '2026-10-10'), true);
  assert.equal(canRegisterPayment(sub(1), '2026-10-10'), false); // acabou de pagar: duplo clique não cobra de novo
  assert.equal(canRegisterPayment(sub(1), '2026-11-02'), false); // ciclo até 09/11: a janela abre em 03/11
  assert.equal(canRegisterPayment(sub(1), '2026-11-03'), true);
  assert.equal(canRegisterPayment(sub(1), '2026-11-09'), true);
  assert.equal(canRegisterPayment(sub(1), '2026-11-15'), true); // vencida
  assert.equal(canRegisterPayment(sub(2), '2026-11-05'), false); // já pagou o seguinte
  assert.equal(canRegisterPayment(sub(2), '2026-12-05'), true); // janela do 2º ciclo (termina 09/12)
});
