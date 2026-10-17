import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSchedule, type Schedule } from './hours';
import { dayWindow, gridRange, offRanges, unionWindow, windowLabel } from './agenda-hours';

const sched = (open: string, close: string, closedDays: number[] = []): Schedule => defaultSchedule().map((d) => ({ ...d, open, close, closed: closedDays.includes(d.day) }));

test('janela do dia a partir do horário da unidade', () => {
  assert.deepEqual(dayWindow(sched('09:00', '19:00'), 3), { from: 540, to: 1140 });
  assert.equal(dayWindow(sched('09:00', '19:00', [0]), 0), 'closed');
  assert.equal(dayWindow(null, 2), null);
  assert.deepEqual(dayWindow(sched('18:00', '02:00'), 5), { from: 1080, to: 1560 }); // passa da meia-noite
});

test('união das unidades', () => {
  assert.deepEqual(unionWindow([{ from: 540, to: 1080 }, { from: 600, to: 1320 }, 'closed']), { from: 540, to: 1320 });
  assert.equal(unionWindow(['closed', 'closed']), 'closed');
  assert.equal(unionWindow([null, null]), null);
});

test('a grade segue o horário do estabelecimento e só cresce para caber agendamento', () => {
  assert.deepEqual(gridRange({ from: 540, to: 1140 }, []), { startH: 9, endH: 19 });
  assert.deepEqual(gridRange({ from: 540, to: 1140 }, [{ startMin: 480, endMin: 510 }, { startMin: 1130, endMin: 1200 }]), { startH: 8, endH: 20 });
  assert.deepEqual(gridRange({ from: 570, to: 1110 }, []), { startH: 9, endH: 19 }); // 9h30–18h30 arredonda para fora
  assert.deepEqual(gridRange(null, []), { startH: 8, endH: 18 });
  assert.deepEqual(gridRange({ from: 1080, to: 1560 }, []), { startH: 18, endH: 24 });
});

test('trechos fora do atendimento', () => {
  assert.deepEqual(offRanges({ from: 600, to: 960 }, 540, 1080), [{ from: 540, to: 600 }, { from: 960, to: 1080 }]);
  assert.deepEqual(offRanges('closed', 540, 1080), [{ from: 540, to: 1080 }]);
  assert.deepEqual(offRanges(null, 540, 1080), []);
});

test('texto do horário de atendimento', () => {
  assert.equal(windowLabel({ from: 540, to: 1140 }), '9h às 19h');
  assert.equal(windowLabel({ from: 570, to: 1110 }), '9h30 às 18h30');
  assert.equal(windowLabel({ from: 1080, to: 1560 }), '18h às 2h');
});
