// Agendar: a grade do dia inteira (livres clicáveis, ocupados riscados, passados esmaecidos), o intervalo entre horários que acompanha
// a duração do serviço (35 min do profissional, não de 30 em 30) ou o que o lugar fixa, e a antecedência mínima 0 refletida na hora.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = (open, close) => JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open, close })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2,"bookingBufferMin"=0,"bookingSlotStepMin"=0,"subscriptionStatus"='ACTIVE',"onboardedAt"=coalesce("onboardedAt",now()); delete from "SlotHold"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; delete from "TimeOff"; update "Unit" set "openingSchedule"='${week('09:00', '18:00')}'::jsonb, address='Rua das Flores, 100 - Centro'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const res = sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','Lucas',1) returning id`).split('\n')[0];
const svc = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Corte',45,4500) returning id`).split('\n')[0];
sql(`insert into "ResourceService"(id,"resourceId","serviceId","durationMin") values (gen_random_uuid()::text,'${res}','${svc}',35)`); // o Lucas faz o Corte em 35 min
const brNow = new Date(Date.now() - 3 * 3600e3);
const today = brNow.toISOString().slice(0, 10);
const tomorrow = new Date(brNow.getTime() + 24 * 3600e3).toISOString().slice(0, 10);
const at = (day, hm) => `(('${day} ${hm}')::timestamp at time zone 'America/Sao_Paulo')`;
sql(`insert into "Booking"(id,"restaurantId","unitId","guestName","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","serviceId") values (gen_random_uuid()::text,'${rid}','${unit}','Cliente do balcão','${res}',${at(tomorrow, '09:35')},${at(tomorrow, '10:10')},'CONFIRMED','Corte',35,4500,'${svc}')`);
const page = (day) => `${BASE}/lugar/${rid}/agendar?servico=${svc}&data=${day}`;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (w, h, mobile) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return p;
};
const C = await mk(390, 844, true);
await C.goto(BASE + '/entrar'); await C.fill('#c-email', 'lucas@teste.com'); await C.fill('#c-password', 'senha-cliente-1'); await C.click('button[type=submit]'); await C.waitForURL('**/carteira**');
const O = await mk(1100, 1000);
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
const grid = async (day) => {
  await C.goto(page(day)); await C.waitForSelector('[data-testid=slot-grid]');
  return C.locator('[data-testid=slot-grid] li').evaluateAll((lis) => lis.map((li) => ({ time: li.innerText.replace(/\s*\(.*\)\s*$/s, '').trim(), kind: li.querySelector('a') ? 'free' : li.querySelector('[data-testid=slot-taken]') ? 'taken' : 'past' })));
};
const policy = async (fields) => {
  await O.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await O.waitForSelector('#ag-notice');
  for (const [id, v] of Object.entries(fields)) await O.selectOption(id, v);
  await O.click('#agenda button:has-text("Salvar regras")'); await O.waitForSelector('#agenda >> text=Regras de agendamento salvas.');
};

// 1. o Corte do Lucas leva 35 min: os horários andam de 35 em 35 (não de 30 em 30), e o ocupado aparece riscado em vez de sumir
let g = await grid(tomorrow);
assert.deepEqual(g.slice(0, 5).map((x) => `${x.time}:${x.kind}`), ['09:00:free', '09:35:taken', '10:10:free', '10:45:free', '11:20:free']);
assert.equal(await C.locator('[data-testid=slot-grid] a').count(), g.filter((x) => x.kind === 'free').length, 'só os livres são clicáveis');
assert.equal(await C.locator('[data-testid=slot-taken]').first().evaluate((e) => getComputedStyle(e).textDecorationLine), 'line-through');
assert.equal(await C.locator('[data-testid=slot-taken]').first().getAttribute('aria-disabled'), 'true');
await C.waitForSelector('text=Os horários riscados já estão ocupados');
console.log('1. horários de 35 em 35 (duração do profissional) e o ocupado riscado, sem sumir da grade OK');

// 2. o lugar fixa o intervalo em 30 min: 09:30 e 10:00 ficam riscados (o corte de 09:35 a 10:10 pega os dois), 10:30 volta a ser livre
await policy({ '#ag-step': '30' });
assert.equal(sql(`select "bookingSlotStepMin" from "Restaurant" where id='${rid}'`), '30');
g = await grid(tomorrow);
assert.deepEqual(g.slice(0, 5).map((x) => `${x.time}:${x.kind}`), ['09:00:free', '09:30:taken', '10:00:taken', '10:30:free', '11:00:free']);
console.log('2. intervalo de 30 min definido pelo lugar vale na grade (e o serviço de 35 min ocupa 35 min de verdade) OK');
await policy({ '#ag-step': '0' });
assert.equal(sql(`select "bookingSlotStepMin" from "Restaurant" where id='${rid}'`), '0');

// 3. a grade mostra o dia todo mesmo depois de passar: o que já passou aparece esmaecido. Antecedência 0: o próximo horário já está livre.
const nowMin = (() => { const d = new Date(Date.now() - 3 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); })();
if (nowMin > 60 && nowMin < 21 * 60) { // evita as bordas da meia-noite
  sql(`update "Unit" set "openingSchedule"='${week('00:00', '23:59')}'::jsonb`);
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  await policy({ '#ag-notice': '0' });
  g = await grid(today);
  assert.ok(g.some((x) => x.kind === 'past'), 'os horários que já passaram continuam na grade, esmaecidos');
  assert.ok(g.filter((x) => x.kind === 'past').every((x) => toMin(x.time) < nowMin + 1), 'só passou o que ficou para trás');
  const first0 = g.find((x) => x.kind === 'free');
  assert.ok(toMin(first0.time) >= nowMin - 1 && toMin(first0.time) - nowMin <= 36, `sem antecedência o próximo horário (${first0.time}) é logo depois de agora (${nowMin})`);
  await policy({ '#ag-notice': '120' });
  g = await grid(today);
  const first2 = g.find((x) => x.kind === 'free');
  assert.ok(toMin(first2.time) >= nowMin + 119 && toMin(first2.time) - (nowMin + 120) <= 36, `com 2 h de antecedência o primeiro livre (${first2.time}) fica a 2 h de agora`);
  assert.ok(g.filter((x) => x.kind === 'past').length > g.filter((x) => x.kind === 'past' && toMin(x.time) < nowMin).length, 'o que cai dentro da antecedência também fica esmaecido');
  await policy({ '#ag-notice': '60' });
  console.log('3. grade do dia todo com os passados esmaecidos; antecedência 0 libera o próximo horário na hora e 2 h empurra o primeiro livre OK');
} else console.log('3. (pulado: horário perto da meia-noite)');

// 4. escolher um horário livre continua funcionando e marca o profissional/horário certo; o ocupado não leva a lugar nenhum
sql(`update "Unit" set "openingSchedule"='${week('09:00', '18:00')}'::jsonb`);
g = await grid(tomorrow);
await C.locator('[data-testid=slot-grid] a', { hasText: '10:10' }).click(); await C.waitForSelector('button:has-text("Confirmar agendamento")');
await C.click('button:has-text("Confirmar agendamento")'); await C.waitForURL('**/perfil/agendamentos**');
assert.equal(sql(`select to_char(("startsAt" at time zone 'UTC') at time zone 'America/Sao_Paulo','HH24:MI')||'|'||"durationMin" from "Booking" where "customerId" is not null`), '10:10|35');
g = await grid(tomorrow);
assert.deepEqual(g.slice(0, 5).map((x) => `${x.time}:${x.kind}`), ['09:00:free', '09:35:taken', '10:10:taken', '10:45:free', '11:20:free']);
console.log('4. reservar o 10:10 grava 35 min e a grade passa a mostrá-lo riscado OK');

sql(`delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; update "Restaurant" set "bookingMinNoticeMin"=60,"bookingSlotStepMin"=0`);
await b.close();
