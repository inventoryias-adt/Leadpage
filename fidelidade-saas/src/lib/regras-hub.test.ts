import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHub, hoursSummary, topicHref, TOPICS, type HubInput } from './regras-hub';

const sched = (open = '11:00', close = '23:00') => Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open, close }));
const base: HubInput = {
  category: 'Hamburgueria', hasLogo: true, brandColor: null, tagline: null, listed: true,
  units: [{ active: true, address: 'Rua A, 1', located: true, schedule: sched() }],
  pointsPerReal: 10, maxRedeemsPerMonth: 5, rewards: 2, rewardsWithoutPhoto: 0,
  promotions: { live: 0, total: 0 }, challenges: { active: 0, total: 0 },
  checkInPoints: 0, referralPoints: 0, birthdayPoints: 0, birthdayPerkOn: false, interactions: 0,
  services: 0, resources: 0, bookingSuggested: false, ordersEnabled: false, shareOut: false, shareIn: false,
};

test('hoursSummary resume a escala', () => {
  assert.equal(hoursSummary(null), '');
  assert.equal(hoursSummary(sched()), 'Seg a Dom: 11h às 23h');
  const s = sched(); s[6] = { day: 6, closed: true, open: '11:00', close: '23:00' };
  assert.match(hoursSummary(s), /^Seg a Sex: 11h às 23h e mais 1 faixa$/);
});

test('clube pronto: 4 de 4 essenciais e nenhuma próxima ação', () => {
  const h = buildHub(base);
  assert.deepEqual(h.essentials, { done: 4, total: 4 });
  assert.equal(h.next, null);
  assert.match(h.groups[0].items[2].summary, /R\$ 1 = 10 pontos · até 5 resgates por CPF no mês/);
});

test('o que falta aparece como próxima ação, na ordem', () => {
  const h = buildHub({ ...base, hasLogo: false, rewards: 0, units: [{ active: true, address: 'Rua A', located: false, schedule: null }] });
  assert.equal(h.essentials.done, 1); // só "Pontos por compra"
  assert.equal(h.next?.id, 'marca');
  const un = h.groups[0].items[1];
  assert.equal(un.status, 'todo');
  assert.match(un.summary, /falta a localização no mapa · faltam os horários/);
  assert.equal(h.groups[0].items[3].status, 'todo');
});

test('campanhas, desafios e chaves mostram situação e resumo', () => {
  const h = buildHub({ ...base, promotions: { live: 1, total: 3 }, challenges: { active: 0, total: 2 }, checkInPoints: 10, referralPoints: 50, birthdayPerkOn: true, ordersEnabled: true, services: 3, resources: 2 });
  const by = Object.fromEntries(h.groups.flatMap((g) => g.items).map((x) => [x.id, x]));
  assert.equal(by.campanhas.status, 'on'); assert.match(by.campanhas.summary, /3 campanhas · 1 valendo agora/);
  assert.equal(by.desafios.status, 'off'); assert.equal(by.desafios.summary, 'todos pausados');
  assert.match(by.engajamento.summary, /check-in 10 pts · indicação 50 pts/);
  assert.equal(by.aniversariante.status, 'on');
  assert.equal(by.pedidos.status, 'on');
  assert.match(by.agenda.summary, /3 serviços · 2 profissionais ou vagas/);
});

test('ideias: até 3, só do que ainda não foi feito', () => {
  const h = buildHub({ ...base, rewardsWithoutPhoto: 1, listed: false });
  assert.equal(h.ideas.length, 3);
  const none = buildHub({ ...base, promotions: { live: 1, total: 1 }, challenges: { active: 1, total: 1 }, referralPoints: 50 });
  assert.deepEqual(none.ideas, []);
});

test('todo assunto tem etapa válida e link próprio', () => {
  for (const t of TOPICS) assert.match(topicHref(t.id), new RegExp(`etapa=${t.etapa}&topico=${t.id}$`));
  assert.equal(new Set(TOPICS.map((t) => t.id)).size, TOPICS.length);
});
