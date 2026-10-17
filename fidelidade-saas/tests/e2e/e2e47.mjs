import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const MAIL = process.env.DEV_MAIL_FILE || '/tmp/dev-mail.jsonl';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=false,"bookingCancelHours"=2; delete from "Notification"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"`);
if (existsSync(MAIL)) rmSync(MAIL);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const uid = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const sched = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, open: '09:00', close: '19:00', closed: false })));
sql(`update "Unit" set "openingSchedule"='${sched}'::jsonb where id='${uid}'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
let maria = sql(`select id from "Customer" where email='maria@teste.com'`);
if (!maria) maria = sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash") values (gen_random_uuid(),'0' || lpad((floor(random()*1e10))::text,10,'0'),'11988887777','Maria Souza','maria@teste.com','x') returning id`).split('\n')[0];
const svc = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid(),'${rid}','Corte',30,5000) returning id`).split('\n')[0];
const rl = sql(`insert into "Resource"(id,"restaurantId","unitId",name,email,capacity) values (gen_random_uuid(),'${rid}','${uid}','Lucas','lucas.barbeiro@teste.com',1) returning id`).split('\n')[0];
const ra = sql(`insert into "Resource"(id,"restaurantId","unitId",name,email,capacity) values (gen_random_uuid(),'${rid}','${uid}','Ana','ana.barbeira@teste.com',1) returning id`).split('\n')[0];

// datas no relógio de Brasília (UTC-3)
const br = new Date(Date.now() - 3 * 3600e3);
const key = (plus) => new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() + plus)).toISOString().slice(0, 10);
const at = (plus, hh, mm = 0) => new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() + plus, hh + 3, mm)).toISOString();
const add = (cust, res, startIso, mins, status = 'CONFIRMED', extra = '') => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","pointsUsed","discountCents","reminderSentAt","createdAt") values (gen_random_uuid(),'${rid}','${uid}','${cust}','${svc}','${res}','${startIso}',('${startIso}'::timestamptz + interval '${mins} minutes'),'${status}','Corte',${mins},5000,${extra || '0,0'},${extra ? 'null' : 'now()'},now()) returning id`).split('\n')[0];
const mine = add(lucas, rl, at(1, 10), 30);
const other = add(maria, ra, at(2, 15), 30);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');

// 1. o botão Reagendar aparece ao lado de Cancelar e leva ao fluxo de horários do mesmo serviço
await c.goto(BASE + '/perfil/agendamentos'); await c.waitForSelector('[data-testid=reschedule]');
await c.click('[data-testid=reschedule]'); await c.waitForURL(`**/agendar?reagendar=${mine}`);
await c.waitForSelector('[data-testid=reschedule-current]');
assert.match(await c.locator('[data-testid=reschedule-current]').innerText(), /às 10h.*Lucas/s);
assert.equal(await c.locator('text=trocar').count(), 0, 'serviço fixo');
console.log('1. Reagendar abre o fluxo com o horário atual e o serviço fixo OK');

// 2. o horário atual do próprio cliente aparece livre; escolher o mesmo é recusado
await c.goto(`${BASE}/lugar/${rid}/agendar?reagendar=${mine}&data=${key(1)}&hora=10:00&prof=${rl}`);
await c.waitForSelector('button:has-text("Confirmar novo horário")');
await c.click('button:has-text("Confirmar novo horário")');
await c.waitForSelector('text=Escolha um dia, horário ou profissional diferente');
console.log('2. mesmo horário e profissional: recusado OK');

// 3. outro dia e horário: o mesmo agendamento muda, volta a aguardar confirmação e o lembrete é zerado
await c.goto(`${BASE}/lugar/${rid}/agendar?reagendar=${mine}&data=${key(2)}&hora=14:00`);
await c.waitForSelector('text=Confirmar novo horário');
await c.click('button:has-text("Confirmar novo horário")');
await c.waitForURL(`**/perfil/agendamentos?remarcado=${mine}`);
await c.waitForSelector('text=Horário remarcado');
assert.equal(sql(`select to_char(("startsAt" at time zone 'UTC') at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI')||'|'||status||'|'||("reminderSentAt" is null)::text||'|'||"priceCents" from "Booking" where id='${mine}'`), `${key(2)} 14:00|PENDING|true|5000`);
assert.equal(sql(`select count(*) from "Booking" where "customerId"='${lucas}'`), '1', 'o mesmo agendamento, sem duplicar');
console.log('3. remarcou para', key(2), '14:00; aguarda confirmação e lembrete zerado OK');

// 4. e-mail à equipe com o antes e o agora
const mails = readFileSync(MAIL, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const m = mails.find((x) => x.to === 'lucas.barbeiro@teste.com' && /remarcado/i.test(x.subject));
assert.ok(m, 'e-mail de remarcação ao profissional'); assert.match(m.text, /Antes:.*10h/); assert.match(m.text, /Agora:.*14h/);
assert.ok(mails.some((x) => x.to === 'ze@burger.com' && /remarcado/i.test(x.subject)), 'e-mail ao estabelecimento');
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title='Pedido de remarcação enviado'`), '1');
console.log('4. equipe avisada (antes e agora) e aviso no app OK');

// 5. horário ocupado por outra pessoa não é oferecido para aquele profissional; trocar de profissional vale
await c.goto(`${BASE}/lugar/${rid}/agendar?reagendar=${mine}&data=${key(2)}&prof=${ra}`);
await c.waitForSelector('ul.grid');
assert.equal(await c.locator('ul.grid a:has-text("15:00")').count(), 0, '15:00 da Ana já está ocupado');
await c.goto(`${BASE}/lugar/${rid}/agendar?reagendar=${mine}&data=${key(2)}&prof=${ra}&hora=16:00`);
await c.click('button:has-text("Confirmar novo horário")'); await c.waitForURL('**/perfil/agendamentos?remarcado=*');
assert.equal(sql(`select "resourceId" from "Booking" where id='${mine}'`), ra);
console.log('5. profissional ocupado não aparece; troca de profissional OK');

// 6. com o horário dentro do prazo mínimo (2 h) o app recusa e explica
sql(`update "Booking" set "startsAt"=now()+interval '1 hour',"endsAt"=now()+interval '90 minutes' where id='${mine}'`);
await c.goto(`${BASE}/lugar/${rid}/agendar?reagendar=${mine}`);
await c.waitForSelector('text=O prazo para remarcar pelo app já passou');
await c.goto(BASE + '/perfil/agendamentos'); await c.waitForSelector('text=O prazo para cancelar pelo app já passou');
assert.equal(await c.locator('[data-testid=reschedule]').count(), 0, 'sem botão fora do prazo');
console.log('6. fora do prazo: sem botão e com explicação OK');

// 7. outro cliente não consegue remarcar o agendamento alheio
const d = await ctx.newPage();
await d.context().clearCookies();
await d.goto(BASE + '/entrar'); await d.fill('#c-email', 'maria@teste.com'); await d.fill('#c-password', 'senha-cliente-1'); await d.click('button[type=submit]').catch(() => {});
await d.waitForTimeout(1500);
if (!d.url().includes('/entrar')) {
  await d.goto(`${BASE}/lugar/${rid}/agendar?reagendar=${mine}`);
  await d.waitForSelector('text=Não foi possível remarcar este agendamento');
  console.log('7. agendamento de outro cliente não abre OK');
} else console.log('7. (sem login da Maria neste banco: pulado)');

await b.close();
console.log('ALL OK (reagendar)');
