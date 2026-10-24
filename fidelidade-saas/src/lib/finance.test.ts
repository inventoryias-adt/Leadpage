import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commissionOf, currentMonth, daysInMonth, lastMonths, monthBounds, monthLabel, monthRange, occurrencesIn, parseCommission, parseEntry, shiftMonth, totals, type EntryRow } from './finance';

test('meses: deslocar, rótulo, limites e dia de Brasília', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-10', 14), '2027-12');
  assert.equal(monthLabel('2026-03'), 'março de 2026');
  assert.equal(daysInMonth('2026-02'), 28);
  assert.equal(daysInMonth('2028-02'), 29);
  assert.deepEqual(monthBounds('2026-02'), { first: '2026-02-01', last: '2026-02-28' });
  assert.deepEqual(lastMonths('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.equal(currentMonth(new Date('2026-11-01T02:59:00Z')), '2026-10');
  assert.equal(currentMonth(new Date('2026-11-01T03:00:00Z')), '2026-11');
  const r = monthRange('2026-10');
  assert.equal(r.from.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(r.to.toISOString(), '2026-11-01T03:00:00.000Z');
});

test('parseEntry valida e normaliza', () => {
  const ok = parseEntry({ kind: 'OUT', description: '  Aluguel   da loja ', category: 'Aluguel', amount: '2.500,00', date: '2026-10-05', recurrence: 'MONTHLY', endsOn: '' });
  assert.deepEqual(ok, { ok: true, value: { kind: 'OUT', description: 'Aluguel da loja', category: 'Aluguel', amountCents: 250000, date: '2026-10-05', recurrence: 'MONTHLY', endsOn: null } });
  const bad = (o: Record<string, unknown>) => parseEntry({ kind: 'OUT', description: 'Luz', category: 'Aluguel', amount: '10', date: '2026-10-05', ...o });
  assert.equal(bad({ kind: 'X' }).ok, false);
  assert.equal(bad({ description: 'a' }).ok, false);
  assert.equal(bad({ category: 'Gorjeta' }).ok, false); // categoria de entrada não vale para despesa
  assert.equal(bad({ amount: '0' }).ok, false);
  assert.equal(bad({ amount: 'abc' }).ok, false);
  assert.equal(bad({ date: '2026-02-30' }).ok, false);
  assert.equal(bad({ recurrence: 'MONTHLY', endsOn: '2026-09-01' }).ok, false);
  assert.equal(bad({ recurrence: 'NONE', endsOn: '2026-09-01' }).ok, true); // data final só vale para fixo; é ignorada
});

test('occurrencesIn: avulso só no mês, fixo todo mês até o fim, dia 31 vira o último dia', () => {
  const rows: EntryRow[] = [
    { id: 'a', kind: 'OUT', description: 'Compra de lâminas', category: 'Insumos e estoque', amountCents: 5000, date: '2026-10-10', recurrence: 'NONE', endsOn: null },
    { id: 'b', kind: 'OUT', description: 'Aluguel', category: 'Aluguel', amountCents: 200000, date: '2026-08-31', recurrence: 'MONTHLY', endsOn: null },
    { id: 'c', kind: 'OUT', description: 'Internet', category: 'Energia, água e internet', amountCents: 12000, date: '2026-09-05', recurrence: 'MONTHLY', endsOn: '2026-10-31' },
  ];
  const oct = occurrencesIn(rows, '2026-10');
  assert.deepEqual(oct.map((o) => `${o.id}:${o.date}`), ['c:2026-10-05', 'a:2026-10-10', 'b:2026-10-31']);
  assert.deepEqual(occurrencesIn(rows, '2026-11').map((o) => o.id), ['b']); // Internet terminou em outubro
  assert.deepEqual(occurrencesIn(rows, '2026-07'), []); // antes de tudo
  assert.equal(occurrencesIn(rows, '2027-02').find((o) => o.id === 'b')?.date, '2027-02-28');
  assert.equal(occurrencesIn(rows, '2026-10').find((o) => o.id === 'b')?.recurring, true);
});

test('comissão: leitura em %, base em centavos e arredondamento', () => {
  assert.equal(parseCommission('40'), 4000);
  assert.equal(parseCommission('12,5%'), 1250);
  assert.equal(parseCommission(''), 0);
  assert.equal(parseCommission('100'), 10000);
  assert.equal(parseCommission('101'), null);
  assert.equal(parseCommission('-5'), null);
  assert.equal(parseCommission('1,234'), null);
  assert.equal(commissionOf(5000, 4000), 2000);
  assert.equal(commissionOf(3333, 1250), 417); // 416,625 → 417
  assert.equal(commissionOf(0, 5000), 0);
});

test('totals', () => assert.deepEqual(totals(1000, 400), { income: 1000, expense: 400, result: 600 }));
