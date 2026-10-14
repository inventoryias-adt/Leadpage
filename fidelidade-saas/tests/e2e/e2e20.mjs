import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '00:00', close: '23:30' })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=false,"bookingMinNoticeMin"=0,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2,"pointsPerReal"=10; delete from "Booking"; delete from "Service"; delete from "Resource"; update "Unit" set "openingSchedule"='${week}'::jsonb`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','João',1)`);
sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Corte masculino',30,5000)`);
const svc = sql(`select id from "Service" where name='Corte masculino'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const balance = () => Number(sql(`select balance from "Wallet" where "customerId"='${lucas}' and "restaurantId"='${rid}'`));
const before = balance();

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const lctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await lctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const l = await lctx.newPage(); l.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await l.goto(BASE + '/entrar'); await l.fill('#c-email', 'lucas@teste.com'); await l.fill('#c-password', 'senha-cliente-1'); await l.click('button[type=submit]'); await l.waitForURL('**/carteira**');

// 1. confirmação manual: o pedido chega "aguardando"
await l.goto(`${BASE}/lugar/${rid}/agendar?servico=${svc}`);
await l.locator('ul.chip-row li a:has-text("Amanhã")').click(); await l.waitForSelector('ul.chip-row a[aria-current=date]:has-text("Amanhã")'); await l.waitForSelector('text=Horários de');
await l.click('ul.grid a:has-text("15:00")'); await l.click('button:has-text("Confirmar agendamento")'); await l.waitForURL('**/perfil/agendamentos**');
await l.waitForSelector('text=Aguardando confirmação');
assert.equal(sql(`select status from "Booking"`), 'PENDING');
assert.ok(Number(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title='Pedido de agendamento enviado'`)) >= 1);
console.log('1. confirmação manual: pedido fica AGUARDANDO e o cliente é avisado OK');

// 2. dono vê o pedido e confirma
const octx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await octx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const o = await octx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await o.waitForSelector('nav a:has-text("Agenda")'); assert.ok(await o.locator('nav a:has-text("Agenda") span[aria-label*="aguardando"]').count(), 'bolinha de pedidos aguardando');
await o.click('nav a:has-text("Agenda")'); await o.waitForSelector('text=Aguardando a sua confirmação (1)');
await o.screenshot({ path: 'ag-dono-pendente.png', fullPage: true });
await o.click('button:has-text("Confirmar")'); await o.waitForSelector('text=Aguardando a sua confirmação', { state: 'detached' });
assert.equal(sql(`select status from "Booking"`), 'CONFIRMED');
assert.ok(Number(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title='Agendamento confirmado'`)) >= 1);
console.log('2. dono vê a bolinha e confirma; o cliente recebe o aviso OK');

// 3. concluir credita os pontos (R$ 50,00 × 10) e entra nas vendas
// põe o atendimento no começo de hoje (Brasília), qualquer que seja a hora em que o teste roda
const todayStart = `((date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') at time zone 'UTC')`;
sql(`update "Booking" set "startsAt"=${todayStart}+interval '1 hour', "endsAt"=${todayStart}+interval '90 minutes'`);
await o.goto(BASE + '/dashboard/agenda'); await o.waitForSelector('button:has-text("Concluir")');
await o.click('button:has-text("Concluir")'); await o.waitForSelector('text=pontos creditados ao cliente');
assert.equal(balance() - before, 500, '500 pontos na carteira');
assert.equal(sql(`select status||'|'||"pointsAwarded"||'|'||("claimId" is not null)::text from "Booking"`), 'COMPLETED|500|true');
assert.equal(sql(`select c."amountCents"||'|'||(c."redeemedAt" is not null)::text||'|'||(c."customerId"='${lucas}')::text from "Claim" c join "Booking" b on b."claimId"=c.id`), '5000|true|true');
assert.equal(sql(`select count(*) from "Transaction" t join "Booking" b on b."claimId"=t."claimId" where t.type='EARN'`), '1');
assert.equal(await o.locator('button:has-text("Concluir")').count(), 0, 'concluído não oferece mais ações');
await o.screenshot({ path: 'ag-dono-concluido.png', fullPage: true });
await l.goto(BASE + '/perfil/agendamentos'); await l.waitForSelector('text=+500 pts');
console.log('3. concluir credita 500 pontos, registra a venda e aparece para o cliente OK');

// 4. faltou e cancelar pelo dono (libera o horário e avisa)
const t0 = (h) => `now()+interval '${h} hours'`;
const mk = (name, h) => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","confirmedAt") select gen_random_uuid()::text,'${rid}',(select id from "Unit" where "restaurantId"='${rid}' limit 1),'${lucas}','${svc}',(select id from "Resource" limit 1),${t0(h)},${t0(h)}+interval '30 minutes','CONFIRMED','${name}',30,5000,now() returning id`);
mk('Barba', 5);
await o.goto(BASE + '/dashboard/agenda'); await o.locator('a[aria-label="Próximo dia"]').click().catch(() => {});
await o.goto(BASE + '/dashboard/agenda');
const barbaDay = sql(`select to_char((("startsAt" at time zone 'UTC') at time zone 'America/Sao_Paulo')::date,'YYYY-MM-DD') from "Booking" where "serviceName"='Barba'`);
await o.goto(`${BASE}/dashboard/agenda?data=${barbaDay}`); await o.waitForSelector('text=Barba');
await o.click('li:has-text("Barba") >> button:has-text("Faltou")'); await o.waitForSelector('li:has-text("Barba") button', { state: 'detached' });
assert.equal(sql(`select status from "Booking" where "serviceName"='Barba'`), 'NO_SHOW');
assert.equal(balance() - before, 500, 'falta não credita pontos');
mk('Sobrancelha', 6);
await o.goto(`${BASE}/dashboard/agenda?data=${sql(`select to_char((("startsAt" at time zone 'UTC') at time zone 'America/Sao_Paulo')::date,'YYYY-MM-DD') from "Booking" where "serviceName"='Sobrancelha'`)}`);
await o.click('li:has-text("Sobrancelha") >> button:has-text("Cancelar")'); await o.waitForSelector('li:has-text("Sobrancelha") button', { state: 'detached' });
assert.equal(sql(`select status||'|'||"canceledBy" from "Booking" where "serviceName"='Sobrancelha'`), 'CANCELED|OWNER');
assert.ok(Number(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title='Agendamento cancelado pelo lugar'`)) >= 1);
console.log('4. faltou (sem pontos) e cancelar pelo dono (avisa o cliente) OK');

// 5. celular: agenda do dono sem rolagem lateral e com a aba extra cabendo
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
await m.goto(BASE + '/login'); await m.fill('#email', 'ze@burger.com'); await m.fill('#password', 'senha-segura-1'); await m.click('button[type=submit]'); await m.waitForURL('**/dashboard');
await m.goto(BASE + '/dashboard/agenda'); await m.waitForSelector('h1:has-text("Agenda")');
assert.ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'agenda do dono: sem rolagem lateral');
await m.screenshot({ path: 'ag-dono-mob.png' });
console.log('5. agenda no celular do dono cabe na tela OK');
sql(`update "Restaurant" set "bookingAutoConfirm"=true,"bookingMinNoticeMin"=60`);
await b.close();
console.log('ALL OK (agenda: painel do dono)');
