import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const SECRET = 'segredo-de-teste-1234567890';
const MAIL = process.env.DEV_MAIL_FILE || '/tmp/dev-mail.jsonl';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(); delete from "Notification"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"`);
if (existsSync(MAIL)) rmSync(MAIL);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const uid = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
const svc = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid(),'${rid}','Corte',40,5000) returning id`).split('\n')[0];
const res = sql(`insert into "Resource"(id,"restaurantId","unitId",name,email,capacity) values (gen_random_uuid(),'${rid}','${uid}','Lucas','lucas.barbeiro@teste.com',1) returning id`).split('\n')[0];
const add = (minAhead, status, createdMinAgo, resId = res) => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","createdAt") values (gen_random_uuid(),'${rid}','${uid}','${cid}','${svc}',${resId ? `'${resId}'` : 'null'},now()+interval '${minAhead} minutes',now()+interval '${minAhead + 40} minutes','${status}','Corte',40,5000,now()-interval '${createdMinAgo} minutes') returning id`).split('\n')[0];
const A = add(20, 'CONFIRMED', 1440), Bk = add(20, 'CONFIRMED', 2), C = add(20, 'PENDING', 1440), D = add(180, 'CONFIRMED', 1440), E = add(20, 'CONFIRMED', 1440);

// 1. rota protegida
const call = (h) => fetch(BASE + '/api/cron/lembretes', { method: 'POST', headers: h });
assert.equal((await call({})).status, 401);
assert.equal((await call({ authorization: 'Bearer errado' })).status, 401);
assert.equal((await fetch(BASE + '/api/cron/lembretes', { headers: { authorization: 'Bearer ' + SECRET + 'x' } })).status, 401);
console.log('1. rota sem segredo/com segredo errado → 401 OK');

// 2. envia só aos que devem: A e E (confirmados, antigos, na janela). Não: B (feito em cima da hora), C (pendente), D (longe)
const ok = await call({ authorization: 'Bearer ' + SECRET });
assert.equal(ok.status, 200);
const body = await ok.json();
assert.equal(body.sent, 2, JSON.stringify(body));
const sent = sql(`select string_agg(id,',' order by id) from "Booking" where "reminderSentAt" is not null`).split(',').sort();
assert.deepEqual(sent, [A, E].sort());
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and title like 'Está tudo certo%'`), '2');
const mails = readFileSync(MAIL, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
assert.equal(mails.filter((m) => m.to === 'lucas@teste.com' && /Está tudo certo/.test(m.subject)).length, 2);
console.log('2. lembrete só para confirmados, antigos e na janela (aviso no app + e-mail) OK');

// 3. segunda rodada não repete
const again = await (await call({ authorization: 'Bearer ' + SECRET })).json();
assert.equal(again.sent, 0);
console.log('3. não envia duas vezes OK');

// 4. execuções simultâneas não duplicam
const F = add(15, 'CONFIRMED', 1440);
const burst = await Promise.all(Array.from({ length: 6 }, () => call({ authorization: 'Bearer ' + SECRET }).then((r) => r.json())));
assert.equal(burst.reduce((n, r) => n + r.sent, 0), 1);
assert.equal(sql(`select count(*) from "Notification" where body like '%Corte%' and "createdAt">now()-interval '1 minute'`), '3');
console.log('4. 6 chamadas simultâneas → 1 só lembrete OK');

// 5. cliente: vê o cartão, responde "sim" em A e "não" em E
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const cctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await cctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); });
const c = await cctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await c.goto(BASE + `/perfil/agendamentos?lembrete=${A}`);
assert.equal(await c.locator('text=Está tudo certo para o seu horário?').count(), 3, 'A, E e F; B/C/D não');
await c.screenshot({ path: 'lembrete-cliente.png', fullPage: true });
const card = (id) => c.locator(`li:has(input[value="${id}"])`);
await card(A).locator('button:has-text("Sim, estarei lá")').click(); await c.waitForSelector('text=Avisamos o lugar que você vai');
assert.equal(sql(`select "reminderAnswer"||'|'||status from "Booking" where id='${A}'`), 'OK|CONFIRMED');
await c.goto(BASE + '/perfil/agendamentos');
assert.ok(await c.locator('text=Você confirmou que vai').count());
await card(E).locator('button:has-text("Não vou poder ir")').click(); await c.waitForSelector('text=Horário liberado');
assert.equal(sql(`select "reminderAnswer"||'|'||status||'|'||"canceledBy" from "Booking" where id='${E}'`), 'NO|CANCELED|CUSTOMER');
console.log('5. cliente confirma (sim) e libera (não) pelo cartão OK');

// 6. horário liberado volta a ficar livre para outro cliente e a equipe é avisada
await new Promise((r) => setTimeout(r, 1500));
const m2 = readFileSync(MAIL, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
assert.ok(m2.some((m) => m.to === 'lucas.barbeiro@teste.com' && /Horário liberado/.test(m.subject)), 'e-mail de horário liberado ao profissional');
assert.ok(m2.some((m) => m.to === 'ze@burger.com' && /Horário liberado/.test(m.subject)), 'e-mail ao estabelecimento');
console.log('6. equipe avisada do horário liberado OK');

// 7. (resposta de outro cliente / dupla resposta: verificado direto em answerReminder, ver testes manuais)

// 8. dono vê as respostas na agenda
const octx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await octx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const o = await octx.newPage();
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
const diaA = sql(`select to_char(("startsAt" - interval '3 hours'), 'YYYY-MM-DD') from "Booking" where id='${A}'`); // dia (Brasília) do horário de teste, que pode virar amanhã perto da meia-noite
await o.goto(BASE + '/dashboard/agenda?data=' + diaA);
await o.waitForSelector('text=Cliente confirmou presença no lembrete');
assert.ok(await o.locator('text=ainda não respondeu').count());
assert.ok(await o.locator('text=avisou que não vai e liberou o horário').count());
console.log('8. dono vê confirmou / sem resposta / liberou OK');
console.log('ALL OK (lembrete 30 min)');
await b.close();
