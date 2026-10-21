// Agendamento sem conflito: o horário fica reservado por 5 minutos para quem está confirmando, some da lista dos outros,
// quem perde recebe horários próximos, e o agendamento feito vira calendário (.ics) com "como chegar".
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '18:00' })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2; delete from "SlotHold"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; update "Unit" set "openingSchedule"='${week}'::jsonb, address='Rua das Flores, 100 - Centro'`);
sql(`delete from "Customer" where email='marina@teste.com'`);
sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash","termsAcceptedAt","termsVersion") select gen_random_uuid()::text,'00000000191',phone,'Marina',email_new,"passwordHash","termsAcceptedAt","termsVersion" from "Customer", (select 'marina@teste.com' as email_new) x where email='lucas@teste.com'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','Ana',1)`);
const sid = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Corte',30,5000) returning id`).split('\n')[0];
const br = new Date(Date.now() - 3 * 3600e3); br.setUTCDate(br.getUTCDate() + 1);
const day = br.toISOString().slice(0, 10);
const page = (hora) => `${BASE}/lugar/${rid}/agendar?servico=${sid}&data=${day}${hora ? `&hora=${hora}` : ''}`;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (email) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto(BASE + '/entrar'); await p.fill('#c-email', email); await p.fill('#c-password', 'senha-cliente-1'); await p.click('button[type=submit]'); await p.waitForURL('**/carteira**');
  return { ctx, p };
};
const A = await mk('lucas@teste.com');
const B = await mk('marina@teste.com');
const times = async (p) => (await p.locator('ul.grid a').allInnerTexts()).map((t) => t.trim());

// 1. A abre o 10:00: o horário fica reservado com contagem regressiva
await A.p.goto(page('10:00')); await A.p.waitForSelector('[data-testid=hold-active]');
assert.match(await A.p.locator('[data-testid=hold-timer]').innerText(), /^[45]:\d\d$/);
assert.equal(sql(`select count(*) from "SlotHold"`), '1');
console.log('1. ao abrir o horário ele fica reservado para o cliente, com contagem de 5 minutos OK');

// 2. B não vê o 10:00 na lista (mas vê os vizinhos) e tem o atalho "próximo horário livre"
await B.p.goto(page()); await B.p.waitForSelector('ul.grid a');
const listB = await times(B.p);
assert.ok(!listB.includes('10:00'), `B não deve ver 10:00: ${listB}`);
assert.ok(listB.includes('09:30') && listB.includes('10:30'), `B vê os vizinhos: ${listB}`);
await B.p.waitForSelector('[data-testid=next-free]');
console.log('2. quem chega depois não vê o horário reservado e ganha o atalho "Próximo horário livre" OK');

// 3. B tenta o mesmo horário pelo link: recebe horários próximos em vez de um beco sem saída
await B.p.goto(page('10:00')); await B.p.waitForSelector('[data-testid=slot-lost]');
assert.ok((await B.p.locator('[data-testid=slot-lost] [data-testid=alt-slot]').count()) >= 1);
await B.p.locator('[data-testid=slot-lost] [data-testid=alt-slot]').first().click();
await B.p.waitForSelector('[data-testid=hold-active]');
console.log('3. horário ocupado vira "saídas" (horários livres mais próximos) e um toque reserva outro OK');

// 4. A confirma: agendamento criado, reserva solta, tela de sucesso com calendário
await A.p.click('button:has-text("Confirmar agendamento")'); await A.p.waitForURL('**/perfil/agendamentos**');
await A.p.waitForSelector('[data-testid=booking-success]');
assert.equal(sql(`select to_char(("startsAt" at time zone 'UTC') at time zone 'America/Sao_Paulo','HH24:MI')||'|'||status from "Booking"`), '10:00|CONFIRMED');
assert.equal(sql(`select count(*) from "SlotHold" h join "Customer" c on c.id=h."customerId" where c.email='lucas@teste.com'`), '0');
await A.p.waitForSelector('[data-testid=calendar-links]');
assert.ok(await A.p.locator('a:has-text("Como chegar")').count());
const icsHref = await A.p.locator('a[href$="/calendario"]').first().getAttribute('href');
const ics = await A.ctx.request.get(BASE + icsHref);
assert.equal(ics.status(), 200); assert.match(ics.headers()['content-type'], /text\/calendar/);
const body = await ics.text();
assert.match(body, /BEGIN:VEVENT/); assert.match(body, /SUMMARY:Corte/); assert.match(body, /LOCATION:Rua das Flores/);
const other = await B.ctx.request.get(BASE + icsHref);
assert.equal(other.status(), 404, 'o .ics de outro cliente não abre');
console.log('4. confirmar cria o agendamento, solta a reserva e a tela de sucesso traz calendário (.ics), Google Agenda e rota OK');

// 5. reserva vencida não segura mais o horário
const held = sql(`select to_char(("startsAt" at time zone 'UTC') at time zone 'America/Sao_Paulo','HH24:MI') from "SlotHold"`);
sql(`update "SlotHold" set "expiresAt"=now()-interval '1 minute'`);
await A.p.goto(page()); await A.p.waitForSelector('ul.grid a');
assert.ok((await times(A.p)).includes(held), `reserva vencida libera ${held}`);
console.log('5. reserva vencida libera o horário para os outros OK');

// 6. alguém fecha o horário no meio: no Confirmar o cliente recebe as saídas
await B.p.goto(page('14:00')); await B.p.waitForSelector('[data-testid=hold-active]');
const ana = sql(`select id from "Resource" limit 1`); const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`delete from "SlotHold"`);
sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","createdAt") select gen_random_uuid()::text,'${rid}',u.id,'${lucas}','${sid}','${ana}',('${day} 14:00:00-03')::timestamptz,('${day} 14:30:00-03')::timestamptz,'CONFIRMED','Corte',30,5000,now() from "Unit" u where u."restaurantId"='${rid}' limit 1`);
await B.p.click('button:has-text("Confirmar agendamento")');
await B.p.waitForSelector('form [data-testid=alt-slot]');
assert.match(await B.p.locator('[role=alert]').first().innerText(), /ocupado|disponível/);
console.log('6. se o horário é fechado antes do Confirmar, aparece o aviso com horários livres próximos OK');

await b.close();
console.log('ALL OK (reserva de horário e calendário)');
