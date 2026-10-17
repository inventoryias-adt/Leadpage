import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(); delete from "Notification"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const uid = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const sched = (open, close, closedDay = -1) => JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, open, close, closed: day === closedDay })));
sql(`update "Unit" set "openingSchedule"='${sched('10:00', '16:00')}'::jsonb where id='${uid}'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const svc = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid(),'${rid}','Corte',30,5000) returning id`).split('\n')[0];
const rl = sql(`insert into "Resource"(id,"restaurantId","unitId",name,capacity,color) values (gen_random_uuid(),'${rid}','${uid}','Lucas',1,'azul') returning id`).split('\n')[0];
const ra = sql(`insert into "Resource"(id,"restaurantId","unitId",name,capacity,color,schedule) values (gen_random_uuid(),'${rid}','${uid}','Ana',1,'rosa','${sched('12:00', '15:00')}'::jsonb) returning id`).split('\n')[0];
const br = new Date(Date.now() - 3 * 3600e3);
const key = (plus) => new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() + plus)).toISOString().slice(0, 10);
const at = (plus, hh, mm = 0) => new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() + plus, hh + 3, mm)).toISOString();
const add = (res, startIso, status) => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","createdAt") values (gen_random_uuid(),'${rid}','${uid}','${lucas}','${svc}','${res}','${startIso}',('${startIso}'::timestamptz + interval '30 minutes'),'${status}','Corte',30,5000,now()) returning id`).split('\n')[0];
const day = 1;
add(rl, at(day, 11), 'CONFIRMED'); add(ra, at(day, 13), 'PENDING');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
const url = (extra = '') => `${BASE}/dashboard/agenda?data=${key(day)}${extra}`;

// 1. a grade é a vista principal e a lista de agendamentos não fica embaixo
await o.goto(url()); await o.waitForSelector('[data-testid=agenda-grid]');
assert.equal(await o.locator('ul[aria-label="Agendamentos do dia"]').count(), 0, 'lista escondida na grade');
assert.equal(await o.locator('button:has-text("Confirmar")').count(), 0);
assert.ok(await o.locator('[data-testid=toggle-vista]:has-text("Ver agendamentos (2)")').count());
console.log('1. grade primeiro; botão "Ver agendamentos (2)" no topo OK');

// 2. as horas da grade seguem o horário do estabelecimento (10h às 16h): nada de 8h ou 18h
const hours = await o.locator('[data-testid=agenda-grid] span.absolute.right-2').allInnerTexts();
assert.equal(hours[0], '10:00'); assert.equal(hours.at(-1), '16:00');
assert.match(await o.locator('[data-testid=agenda-hours]').innerText(), /Atendimento: 10h às 16h/);
console.log('2. grade de', hours[0], 'a', hours.at(-1), '= horário do estabelecimento OK');

// 3. a escala da Ana (12h às 15h) sombreia o que está fora dela dentro da coluna dela
assert.ok(await o.locator('[data-testid=agenda-grid] div[aria-hidden].bg-slate-200\\/60').count() >= 2, 'trechos fora do atendimento sombreados');
console.log('3. fora do horário sombreado OK');

// 4. o botão leva à lista com as ações; "Ver grade do dia" volta
await o.click('[data-testid=toggle-vista]'); await o.waitForURL('**vista=lista**');
await o.waitForSelector('ul[aria-label="Agendamentos do dia"]');
assert.ok(await o.locator('button:has-text("Confirmar")').count(), 'ações na lista');
assert.equal(await o.locator('[data-testid=agenda-grid]').count(), 0);
await o.click('[data-testid=toggle-vista]:has-text("Ver grade do dia")'); await o.waitForSelector('[data-testid=agenda-grid]');
console.log('4. alterna entre grade e lista OK');

// 5. clicar num bloco da grade abre a lista naquele agendamento
await o.locator('[data-testid=agenda-grid] a[aria-label*="Confirmado"]').first().click();
await o.waitForSelector('[data-testid=booking-modal]'); assert.ok(await o.locator('[data-testid=booking-modal] button:has-text("Concluir")').count(), 'o modal traz as ações');
console.log('5. bloco da grade abre o agendamento na lista OK');

// 6. agendamento fora do horário amplia a grade só o necessário; dia fechado avisa
add(rl, at(day, 9), 'CONFIRMED');
await o.goto(url()); await o.waitForSelector('[data-testid=agenda-grid]');
const h2 = await o.locator('[data-testid=agenda-grid] span.absolute.right-2').allInnerTexts();
assert.equal(h2[0], '09:00'); assert.equal(h2.at(-1), '16:00');
const wd = new Date(`${key(day)}T12:00:00Z`).getUTCDay();
sql(`update "Unit" set "openingSchedule"='${sched('10:00', '16:00', wd)}'::jsonb where id='${uid}'`);
await o.goto(url()); await o.waitForSelector('[data-testid=agenda-hours]');
assert.match(await o.locator('[data-testid=agenda-hours]').innerText(), /fechado neste dia/i);
console.log('6. grade cresce para caber o agendamento das 9h e avisa dia fechado OK');

await b.close();
console.log('ALL OK (agenda do dono)');
