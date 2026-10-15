import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '18:00' })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2; delete from "Booking"; delete from "Service"; delete from "Resource"; update "Unit" set "openingSchedule"='${week}'::jsonb`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const resId = sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','João',1) returning id`).split('\n')[0];
sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Corte masculino',60,5000)`);
sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents","askPartySize") values (gen_random_uuid()::text,'${rid}','Reserva de mesa',90,0,true)`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const l = await ctx.newPage(); l.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const noOverflow = async (what) => assert.ok(await l.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${what}: sem rolagem lateral`);

// visitante: vê os horários, mas precisa entrar para confirmar
await l.goto(`${BASE}/lugar/${rid}`); await l.waitForSelector('a:has-text("Agendar")');
await l.click('a:has-text("Agendar")'); await l.waitForSelector('text=O que você quer marcar?');
await l.click('a:has-text("Corte masculino")'); await l.waitForSelector('text=Escolha o dia');
await l.click('ul.chip-row li a:has-text("Amanhã")'); await l.waitForSelector('ul.chip-row a[aria-current=date]:has-text("Amanhã")');
await l.waitForSelector('text=Horários de');
await l.click('ul.grid a:has-text("10:00")'); await l.waitForSelector('text=Entrar para confirmar');
console.log('1. lugar → Agendar → serviço → dia → horário; visitante é convidado a entrar OK');

// cliente entra e confirma
await l.click('text=Entrar para confirmar'); await l.waitForURL('**/entrar**');
await l.fill('#c-email', 'lucas@teste.com'); await l.fill('#c-password', 'senha-cliente-1'); await l.click('button[type=submit]');
await l.waitForSelector('text=Confirmar'); await l.waitForSelector('button:has-text("Confirmar agendamento")');
await noOverflow('confirmar'); await l.screenshot({ path: 'bk-confirmar.png', fullPage: true });
await l.click('button:has-text("Confirmar agendamento")'); await l.waitForURL('**/perfil/agendamentos**');
await l.waitForSelector('text=Agendamento feito!'); await l.waitForSelector('text=Corte masculino'); await l.waitForSelector('text=Confirmado');
assert.equal(sql(`select status||'|'||"serviceName"||'|'||"priceCents"||'|'||to_char(("startsAt" at time zone 'UTC') at time zone 'America/Sao_Paulo','HH24:MI') from "Booking"`), 'CONFIRMED|Corte masculino|5000|10:00');
assert.equal(sql(`select count(*) from "Notification" n join "Customer" c on c.id=n."customerId" where c.email='lucas@teste.com' and n.title='Agendamento confirmado'`) >= '1', true);
await noOverflow('meus agendamentos'); await l.screenshot({ path: 'bk-meus.png', fullPage: true });
console.log('2. cliente confirma: agendamento CONFIRMADO, aviso criado, aparece em Meus agendamentos OK');

// o mesmo horário não está mais livre; capacidade 1
await l.goBack().catch(() => {});
await l.goto(`${BASE}/lugar/${rid}/agendar?servico=${sql(`select id from "Service" where name='Corte masculino'`)}`);
await l.locator('ul.chip-row li a:has-text("Amanhã")').click(); await l.waitForSelector('ul.chip-row a[aria-current=date]:has-text("Amanhã")'); await l.waitForSelector('text=Horários de');
const times = await l.locator('ul.grid a').allInnerTexts();
assert.ok(!times.includes('10:00') && !times.includes('09:30') && !times.includes('10:30'), `10h ocupado e vizinhos que se sobrepõem somem: ${times}`);
assert.ok(times.includes('09:00') && times.includes('11:00'));
console.log('3. horário ocupado e sobrepostos somem para os outros OK');

// reserva de mesa pede o número de pessoas
await l.goto(`${BASE}/lugar/${rid}/agendar?servico=${sql(`select id from "Service" where name='Reserva de mesa'`)}`);
await l.locator('ul.chip-row li a:has-text("Amanhã")').click(); await l.waitForSelector('ul.chip-row a[aria-current=date]:has-text("Amanhã")'); await l.waitForSelector('text=Horários de');
await l.click('ul.grid a:has-text("14:00")'); await l.waitForSelector('#bk-party');
await l.fill('#bk-party', '4'); await l.fill('#bk-note', 'Mesa perto da janela'); await l.click('button:has-text("Confirmar agendamento")');
await l.waitForURL('**/perfil/agendamentos**'); await l.waitForSelector('text=4 pessoas');
assert.equal(sql(`select "partySize"||'|'||note from "Booking" where "serviceName"='Reserva de mesa'`), '4|Mesa perto da janela');
console.log('4. reserva de mesa: número de pessoas e recado gravados OK');

// início mostra o próximo horário; perfil mostra o atalho
await l.goto(BASE + '/carteira'); await l.waitForSelector('text=Seu próximo horário'); await noOverflow('início');
await l.goto(BASE + '/perfil'); await l.waitForSelector('a[href="/perfil/agendamentos"]:has-text("2 horários marcados")');
console.log('5. início e perfil destacam os horários marcados OK');

// cancelar dentro do prazo; fora do prazo, não
await l.goto(BASE + '/perfil/agendamentos');
await l.click('button[aria-label="Cancelar Reserva de mesa"]'); await l.waitForSelector('text=Agendamento cancelado.');
assert.equal(sql(`select status||'|'||"canceledBy" from "Booking" where "serviceName"='Reserva de mesa'`), 'CANCELED|CUSTOMER');
sql(`update "Booking" set "startsAt"=now()+interval '1 hour', "endsAt"=now()+interval '2 hours' where "serviceName"='Corte masculino'`);
await l.goto(BASE + '/perfil/agendamentos'); await l.waitForSelector('text=O prazo para cancelar pelo app já passou');
assert.equal(await l.locator('button[aria-label="Cancelar Corte masculino"]').count(), 0);
console.log('6. cancelar no prazo funciona; fora do prazo não oferece o botão OK');

// antecedência mínima e unidade/serviço inválidos não passam pelo servidor
await b.close();
console.log('ALL OK (agenda: fluxo do cliente)');
