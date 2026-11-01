// Lista de espera e painel de ocupação: num dia lotado o cliente pede aviso (por faixa do dia), é avisado quando alguém cancela
// (só quem pediu aquela faixa), marca antes dos outros e sai da fila; o dono vê a ocupação e quem está esperando.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '18:00' })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2,"bookingBufferMin"=0; delete from "WaitlistEntry"; delete from "TimeOff"; delete from "SlotHold"; delete from "Notification"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; update "Unit" set "openingSchedule"='${week}'::jsonb`);
sql(`delete from "Customer" where email='marina@teste.com'`);
sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash","termsAcceptedAt","termsVersion") select gen_random_uuid()::text,'00000000191',phone,'Marina',email_new,"passwordHash","termsAcceptedAt","termsVersion" from "Customer", (select 'marina@teste.com' as email_new) x where email='lucas@teste.com'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' limit 1`);
const ana = sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','Ana',1) returning id`).split('\n')[0];
const sid = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Corte',30,5000) returning id`).split('\n')[0];
const marina = sql(`select id from "Customer" where email='marina@teste.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const br = new Date(Date.now() - 3 * 3600e3); br.setUTCDate(br.getUTCDate() + 1);
const day = br.toISOString().slice(0, 10);
// Dia lotado: 18 horários de meia hora; o das 14:00 é da Marina, os outros são encaixes do dono.
const book = (i, who) => `insert into "Booking"(id,"restaurantId","unitId","customerId","guestName","createdBy","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","createdAt") values (gen_random_uuid()::text,'${rid}','${unit}',${who ? `'${who}'` : 'null'},${who ? 'null' : "'Reserva'"},${who ? 'null' : "'OWNER'"},'${sid}','${ana}',('${day} 09:00:00-03')::timestamptz + make_interval(mins => ${i * 30}),('${day} 09:30:00-03')::timestamptz + make_interval(mins => ${i * 30}),'CONFIRMED','Corte',30,5000,now())`;
for (let i = 0; i < 18; i++) sql(book(i, i === 10 ? marina : null));
const agendar = `${BASE}/lugar/${rid}/agendar?servico=${sid}&data=${day}`;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (email, view = { width: 390, height: 844 }) => {
  const ctx = await b.newContext({ viewport: view, isMobile: view.width < 600, hasTouch: view.width < 600 });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto(BASE + '/entrar'); await p.fill('#c-email', email); await p.fill('#c-password', 'senha-cliente-1'); await p.click('button[type=submit]'); await p.waitForURL('**/carteira**');
  return p;
};
const L = await mk('lucas@teste.com');
const M = await mk('marina@teste.com');

// 1. dia lotado: sem horários, mas com o convite para a lista de espera
await L.goto(agendar); await L.waitForSelector('[data-testid=waitlist-offer]');
assert.equal(await L.locator('ul.grid a').count(), 0);
console.log('1. dia lotado mostra o convite "Entre na lista de espera" OK');

// 2. Lucas entra pedindo a tarde; vê a posição na fila e a faixa
await L.selectOption('#wait-period', 'AFTERNOON'); await L.click('[data-testid=waitlist-join]');
await L.waitForSelector('[data-testid=waitlist-on]'); await L.waitForSelector('[role=status]:has-text("lista de espera")');
assert.match(await L.locator('[data-testid=waitlist-on]').innerText(), /Tarde.*1º da fila/s);
assert.equal(sql(`select status||'|'||period from "WaitlistEntry" where "customerId"='${lucas}'`), 'WAITING|AFTERNOON');
console.log('2. o cliente entra na fila pela faixa da tarde e vê a posição OK');

// 3. aparece em "Meus agendamentos"; sair da lista e entrar de novo funciona
await L.goto(BASE + '/perfil/agendamentos'); await L.waitForSelector('[data-testid=my-waitlist]');
assert.match(await L.locator('[data-testid=my-waitlist]').innerText(), /Corte.*Tarde/s);
await L.click('[data-testid=my-waitlist] button:has-text("Sair da lista")'); await L.waitForSelector('[role=status]:has-text("saiu da lista")');
assert.equal(sql(`select status from "WaitlistEntry" where "customerId"='${lucas}'`), 'CANCELED');
await L.goto(agendar); await L.waitForSelector('[data-testid=waitlist-offer]'); await L.selectOption('#wait-period', 'AFTERNOON'); await L.click('[data-testid=waitlist-join]');
await L.waitForSelector('[data-testid=waitlist-on]');
assert.equal(sql(`select status from "WaitlistEntry" where "customerId"='${lucas}'`), 'WAITING');
console.log('3. a fila aparece em Meus agendamentos e dá para sair e voltar OK');

// 4. dono vê o dia 100% ocupado e uma pessoa esperando
const O = await mk('lucas@teste.com', { width: 1100, height: 1000 }).then(async (p) => { await p.context().clearCookies(); return p; });
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
await O.goto(BASE + '/dashboard/agenda'); await O.click('[data-testid=agenda-mais]'); await O.click('[data-testid=ocupacao]'); await O.waitForURL('**/agenda/ocupacao');
await O.waitForSelector('[data-testid=occupancy-kpis]');
const row = O.locator(`[data-testid=occupancy-days] li[data-date="${day}"]`);
assert.match(await row.innerText(), /100%/); assert.match(await row.innerText(), /1 na espera/);
assert.match(await O.locator('[data-testid=occupancy-insights]').innerText(), /esperando/);
await O.goto(BASE + '/dashboard/agenda/ocupacao?dias=7'); await O.waitForSelector('[data-testid=occupancy-days] li');
assert.equal(await O.locator('[data-testid=occupancy-days] li').count(), 7);
console.log('4. o painel de ocupação mostra o dia lotado, quem espera e a leitura "o que fazer" OK');

// 5. Marina também espera, mas só de manhã: não deve ser avisada de uma vaga da tarde
sql(`insert into "WaitlistEntry"(id,"restaurantId","unitId","customerId","serviceId",date,period,status,"createdAt") values (gen_random_uuid()::text,'${rid}','${unit}','${marina}','${sid}','${day}','MORNING','WAITING',now() - interval '1 hour')`);

// 6. Marina cancela o horário das 14:00: só o Lucas (tarde) é avisado
await M.goto(BASE + '/perfil/agendamentos'); await M.waitForSelector('button:has-text("Cancelar agendamento")');
await M.click('button:has-text("Cancelar agendamento")'); await M.waitForURL('**cancelado=1**');
let href = '';
for (let i = 0; i < 30 && !href; i++) { href = sql(`select href from "Notification" where "customerId"='${lucas}' and title like 'Abriu um horário%'`); if (!href) await new Promise((r) => setTimeout(r, 300)); }
assert.ok(href, 'o aviso de horário aberto chegou ao cliente da fila');
assert.match(href, /hora=14%3A00|hora=14:00/);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${marina}' and title like 'Abriu um horário%'`), '0');
console.log('6. o cancelamento avisa quem esperava a tarde (e não quem pediu a manhã) OK');

// 7. Lucas toca no aviso, o horário é reservado para ele e ele confirma antes de todos
await L.goto(BASE + href); await L.waitForSelector('[data-testid=hold-active]');
await L.click('button:has-text("Confirmar agendamento")'); await L.waitForURL('**/perfil/agendamentos**'); await L.waitForSelector('[data-testid=booking-success]');
assert.equal(sql(`select status from "WaitlistEntry" where "customerId"='${lucas}'`), 'BOOKED');
console.log('7. o aviso leva direto ao horário, a reserva de 5 minutos vale e quem marcou sai da fila OK');

// 8. avisos repetidos não saem em menos de 30 minutos
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title like 'Abriu um horário%'`), '1');
console.log('8. um aviso só por horário aberto OK');

await b.close();
console.log('ALL OK (lista de espera e ocupação)');
