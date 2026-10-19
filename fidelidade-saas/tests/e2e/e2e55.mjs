// Agenda do dono: a chave "Calendário | Lista" aparece em todos os períodos (dia, semana, mês) e a escolha acompanha a pessoa.
// Semana em grade (um dia por coluna, agendamentos sobrepostos lado a lado) e mês em calendário (toque num dia abre o dia).
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(); delete from "Notification"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const uid = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const sched = (open, close) => JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, open, close, closed: false })));
sql(`update "Unit" set "openingSchedule"='${sched('09:00', '18:00')}'::jsonb where "restaurantId"='${rid}'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const svc = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid(),'${rid}','Corte',45,5000) returning id`).split('\n')[0];
const rl = sql(`insert into "Resource"(id,"restaurantId","unitId",name,capacity,color) values (gen_random_uuid(),'${rid}','${uid}','Lucas',1,'azul') returning id`).split('\n')[0];
const ra = sql(`insert into "Resource"(id,"restaurantId","unitId",name,capacity,color) values (gen_random_uuid(),'${rid}','${uid}','Ana',1,'rosa') returning id`).split('\n')[0];
const br = new Date(Date.now() - 3 * 3600e3);
const at = (hh, mm = 0) => new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate(), hh + 3, mm)).toISOString();
const add = (res, startIso, status) => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","createdAt") values (gen_random_uuid(),'${rid}','${uid}','${lucas}','${svc}','${res}','${startIso}',('${startIso}'::timestamptz + interval '45 minutes'),'${status}','Corte',45,5000,now()) returning id`).split('\n')[0];
// hoje: dois atendimentos que se sobrepõem (10h00 e 10h15), um cancelado (não aparece) e um que não encosta (14h)
add(rl, at(10), 'CONFIRMED'); add(ra, at(10, 15), 'PENDING'); add(rl, at(9), 'CANCELED'); add(rl, at(14), 'COMPLETED');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
const periodo = (nome) => o.click(`[role=group][aria-label="Período"] a:has-text("${nome}")`);
const current = (v) => o.locator(`[data-testid=vista-${v}]`).getAttribute('aria-current');

// 1. no dia: chave no topo, calendário marcado, resumo do dia
await o.goto(BASE + '/dashboard/agenda'); await o.waitForSelector('[data-testid=agenda-grid]');
assert.equal(await current('grade'), 'true'); assert.equal(await current('lista'), null);
assert.match(await o.locator('[data-testid=vista-lista]').innerText(), /Lista \(3\)/);
const resumo = await o.locator('[data-testid=agenda-resumo]').innerText();
assert.match(resumo, /3 agendamentos/); assert.match(resumo, /1 aguardando/); assert.match(resumo, /1 confirmado/); assert.match(resumo, /1 concluído/);
console.log('1. dia: chave Calendário | Lista no topo e resumo "3 agendamentos · 1 aguardando…" OK');

// 2. a chave continua na semana (antes sumia) e a semana vem em grade, um dia por coluna
await periodo('Semana'); await o.waitForURL('**per=semana**'); await o.waitForSelector('[data-testid=agenda-week]');
assert.ok(await o.locator('[data-testid=vista-grade]').isVisible() && await o.locator('[data-testid=vista-lista]').isVisible(), 'a chave não some ao trocar de período');
assert.equal(await current('grade'), 'true');
assert.equal(await o.locator('[data-testid=week-day]').count(), 7);
assert.equal(await o.locator('[data-testid=week-block]').count(), 3, 'o cancelado não aparece');
console.log('2. semana: a chave continua no topo e a grade tem 7 dias e 3 blocos OK');

// 3. agendamentos que se sobrepõem ficam lado a lado, sem cobrir um ao outro
const blocks = o.locator('[data-testid=week-block]');
const box = async (i) => blocks.nth(i).boundingBox();
const bx = [await box(0), await box(1), await box(2)];
const sameCol = bx.filter((x) => Math.abs(x.x - bx[0].x) < 80 || Math.abs(x.x - bx[1].x) < 80);
const overlapping = (await o.locator('[data-testid=week-block][aria-label*="10:00"], [data-testid=week-block][aria-label*="10:15"]').all());
assert.equal(overlapping.length, 2);
const [p1, p2] = [await overlapping[0].boundingBox(), await overlapping[1].boundingBox()];
assert.ok(p1.x + p1.width <= p2.x + 1 || p2.x + p2.width <= p1.x + 1, 'blocos sobrepostos não se cobrem');
assert.ok(sameCol.length >= 2);
console.log('3. atendimentos sobrepostos ficam lado a lado OK');

// 4. tocar no bloco abre os detalhes com as ações; o dia no cabeçalho abre o dia
await o.locator('[data-testid=week-block][aria-label*="10:15"]').click();
await o.waitForSelector('[data-testid=booking-modal]'); assert.ok(await o.locator('[data-testid=booking-modal] button:has-text("Confirmar")').count());
await o.goto(BASE + '/dashboard/agenda?per=semana'); await o.waitForSelector('[data-testid=agenda-week]');
await o.locator('[data-testid=week-day] a[aria-label^="Abrir o dia"]').nth((br.getUTCDay() + 6) % 7).click();
await o.waitForSelector('[data-testid=agenda-grid]'); assert.ok(!/per=/.test(o.url()), 'volta para o dia');
console.log('4. bloco abre os detalhes; cabeçalho do dia abre o dia OK');

// 5. mês em calendário: o dia de hoje mostra a contagem e toque leva ao dia
await periodo('Mês'); await o.waitForURL('**per=mes**'); await o.waitForSelector('[data-testid=agenda-month]');
assert.ok(await o.locator('[data-testid=vista-grade]').isVisible());
const hoje = o.locator('[data-testid=month-day][data-count="3"]');
assert.equal(await hoje.count(), 1, 'só hoje tem agendamentos (3, sem o cancelado)');
assert.match(await hoje.getAttribute('aria-label'), /3 agendamentos, 1 aguardando/);
await hoje.click(); await o.waitForSelector('[data-testid=agenda-grid]');
console.log('5. mês em calendário: hoje com 3 agendamentos; toque abre o dia OK');

// 6. a lista também acompanha: dia → semana → mês, sempre em lista, e o calendário volta
await o.click('[data-testid=vista-lista]'); await o.waitForURL('**vista=lista**'); await o.waitForSelector('ul[aria-label="Agendamentos do dia"]');
await periodo('Semana'); await o.waitForURL('**per=semana**');
assert.ok(/vista=lista/.test(o.url())); assert.equal(await o.locator('[data-testid=agenda-week]').count(), 0);
assert.ok(await o.locator('section[aria-label*="/"] h2').count() >= 1);
await periodo('Mês'); await o.waitForURL('**per=mes**');
assert.ok(/vista=lista/.test(o.url())); assert.equal(await o.locator('[data-testid=agenda-month]').count(), 0);
await o.click('[data-testid=vista-grade]'); await o.waitForSelector('[data-testid=agenda-month]');
assert.ok(!/vista=/.test(o.url()));
console.log('6. a escolha Lista/Calendário acompanha dia, semana e mês OK');

// 7. no celular: nada vaza para o lado (a semana rola dentro do cartão)
const mctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await mctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const m = await mctx.newPage();
await m.goto(BASE + '/login'); await m.fill('#email', 'ze@burger.com'); await m.fill('#password', 'senha-segura-1'); await m.click('button[type=submit]'); await m.waitForURL('**/dashboard');
for (const per of ['', '?per=semana', '?per=mes']) {
  await m.goto(BASE + '/dashboard/agenda' + per); await m.waitForSelector('[data-testid=vista-grade]');
  const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 1, `a página vaza ${over}px para o lado em ${per || 'dia'}`);
}
console.log('7. celular: dia, semana e mês sem rolagem lateral da página OK');

await o.goto(BASE + '/dashboard/agenda?per=semana'); await o.waitForSelector('[data-testid=agenda-week]');
await o.screenshot({ path: 'agenda-semana.png', fullPage: true });
await b.close();
console.log('ALL OK (agenda: calendário e lista em todos os períodos)');
