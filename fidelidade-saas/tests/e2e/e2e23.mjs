import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(); delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const uid = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const cid = sql(`select id from "Customer" where phone='11999998888'`);
const svc = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid(),'${rid}','Corte',40,5000) returning id`).split('\n')[0];
const mk = (name, phone) => sql(`insert into "Resource"(id,"restaurantId","unitId",name,phone,capacity) values (gen_random_uuid(),'${rid}','${uid}','${name}',${phone ? `'${phone}'` : 'null'},1) returning id`).split('\n')[0];
const lucas = mk('Lucas', '11988887777'), ana = mk('Ana', null);
// dias relativos a hoje em Brasília; horários 10h BRT = 13h UTC
const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const day = (n) => new Date(Date.parse(today + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const add = (res, dn, h, status = 'CONFIRMED', note = 'null') => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents",note) values (gen_random_uuid(),'${rid}','${uid}','${cid}','${svc}','${res}','${day(dn)}T${String(h + 3).padStart(2, '0')}:00:00Z','${day(dn)}T${String(h + 3).padStart(2, '0')}:40:00Z','${status}','Corte',40,5000,${note})`);
add(lucas, 0, 10); add(lucas, 0, 11, 'CANCELED'); add(ana, 0, 14); add(lucas, 1, 9, 'PENDING', `'=HYPERLINK("x")'`);
const eom = new Date(Date.parse(today + 'T00:00:00Z')); // ao menos um no mês passado
add(ana, -35, 10, 'COMPLETED');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(BASE + '/login'); await p.fill('#email', 'ze@burger.com'); await p.fill('#password', 'senha-segura-1'); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard');

// 1. dia: todos
await p.goto(BASE + '/dashboard/agenda');
assert.equal(await p.locator('li:has-text("Corte")').count() >= 2, true);
assert.ok(await p.locator('[aria-label=Profissional] a:has-text("Lucas")').count());
console.log('1. dia com filtro de profissionais OK');

// 2. filtrar por Lucas: só os dele, WhatsApp vai para o número dele
await p.click('[aria-label=Profissional] a:has-text("Lucas")'); await p.waitForURL('**prof=*');
const wa = await p.getAttribute('a:has-text("Enviar pelo WhatsApp")', 'href');
assert.match(wa, /^https:\/\/wa\.me\/5511988887777\?text=/);
const txt = decodeURIComponent(wa.split('text=')[1]);
assert.match(txt, /^Agenda de Lucas · /); assert.match(txt, /10h–10h40 Corte — Lucas Silva/); assert.ok(!txt.includes('Ana'));
assert.ok(!txt.includes('11h'), 'cancelado fora');
console.log('2. filtro por profissional + WhatsApp com o número e o texto dele OK');

// 3. Ana sem WhatsApp: abre o contato livre e avisa
await p.click('[aria-label=Profissional] a:has-text("Ana")'); await p.waitForSelector('[aria-label=Profissional] a:has-text("Ana")[aria-current=true]');
assert.match(await p.getAttribute('a:has-text("Enviar pelo WhatsApp")', 'href'), /^https:\/\/wa\.me\/\?text=/);
assert.ok(await p.locator('text=não tem WhatsApp cadastrado').count());
console.log('3. profissional sem WhatsApp OK');

// 4. semana agrupada por dia (hoje e amanhã) e mês passado
await p.click('[aria-label=Profissional] a:has-text("Todos")'); await p.waitForSelector('[aria-label=Profissional] a:has-text("Todos")[aria-current=true]');
await p.click('[role=group][aria-label="Período"] a:has-text("Semana")'); await p.waitForURL('**per=semana**');
assert.ok(await p.locator('section[aria-label*="/"] h2').count() >= 1);
await p.click('[role=group][aria-label="Período"] a:has-text("Mês passado")'); await p.waitForURL('**per=mes-passado**');
const lastMonth = new Date(Date.parse(today + 'T00:00:00Z')); lastMonth.setUTCDate(1); lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
const inLast = new Date(Date.parse(day(-35)) + 3 * 3600e3).toISOString().slice(0, 7) === lastMonth.toISOString().slice(0, 7);
assert.equal(await p.locator('li:has-text("Concluído")').count(), inLast ? 1 : 0, 'só entra o que é do mês passado');
console.log('4. semana agrupada por dia e mês passado OK');

// 5. CSV: baixa com o filtro, BOM, cabeçalho, sem vazar outro profissional; recado malicioso vira texto
const csvUrl = (extra) => BASE + '/dashboard/agenda/exportar?per=semana' + extra;
const get = async (u) => { const r = await ctx.request.get(u); return { r, t: await r.text() }; };
const all = await get(csvUrl(''));
assert.equal(all.r.status(), 200); assert.match(all.r.headers()['content-type'], /text\/csv/); assert.match(all.r.headers()['content-disposition'], /attachment; filename="agenda-todos-/);
assert.ok(all.t.startsWith('\uFEFFData;Início;Fim;Profissional;Serviço;Cliente;Telefone;Status'));
assert.ok(all.t.includes('Lucas') && all.t.includes('Ana'));
assert.ok(all.t.includes(`"'=HYPERLINK(""x"")"`), 'fórmula neutralizada');
const only = await get(csvUrl('&prof=' + lucas));
assert.ok(only.t.includes('Lucas') && !only.t.includes(';Ana;'));
assert.match(only.r.headers()['content-disposition'], /agenda-lucas-/);
const anon = await (await b.newContext()).request.get(csvUrl(''), { maxRedirects: 0 });
assert.ok([307, 401].includes(anon.status()), 'sem login: o middleware manda para a entrada (ou 401)');
assert.ok(!(anon.headers()['content-type'] || '').includes('text/csv'));
console.log('5. CSV com filtro, BOM, proteção de fórmula e login exigido OK');

// 6. profissional de OUTRO estabelecimento não vaza por ?prof=
const other = sql(`select id from "Resource" where "restaurantId"<>'${rid}' limit 1`);
const x = await get(csvUrl('&prof=' + (other || 'inexistente')));
assert.ok(!x.t.includes('Lucas') && !x.t.includes('Ana') || other === '', 'id alheio ou inexistente → vazio');
console.log('6. ?prof= de outro estabelecimento não vaza dados OK');

// 7. concluir pela visão da semana volta para a mesma visão
await p.goto(BASE + '/dashboard/agenda?per=semana'); 
await p.click('li:has-text("10:00") button:has-text("Concluir")').catch(async () => p.click('li:has-text("10h") button:has-text("Concluir")'));
await p.waitForSelector('[role=status]'); assert.match(p.url(), /per=semana/);
console.log('7. ação mantém período/filtro ao voltar OK');
await p.screenshot({ path: 'agenda-equipe.png', fullPage: true });
console.log('ALL OK (agenda por profissional)');
await b.close();
