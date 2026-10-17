import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(); delete from "Redemption"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const uid = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
let ana = sql(`select id from "Customer" where email='ana.resgates@teste.com'`);
if (!ana) ana = sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash") values (gen_random_uuid(),'0' || lpad((floor(random()*1e10))::text,10,'0'),'11977776666','Ana Costa','ana.resgates@teste.com','x') returning id`).split('\n')[0];
const reward = (name, pts, cash = 0) => sql(`insert into "Reward"(id,"restaurantId",name,"pointsCost","cashCents","createdAt") values (gen_random_uuid(),'${rid}','${name}',${pts},${cash},now()) returning id`).split('\n')[0];
const rBrownie = reward('Brownie', 500), rCafe = reward('Café coado', 150, 300);
const wallet = (c) => sql(`insert into "Wallet"(id,"customerId","restaurantId",balance,"createdAt") values (gen_random_uuid(),'${c}','${rid}',9999,now()) on conflict ("customerId","restaurantId") do update set balance=9999 returning id`).split('\n')[0];
const wl = wallet(lucas), wa = wallet(ana);
const red = (c, w, r, name, pts, cash, code, status, daysAgo) => sql(`insert into "Redemption"(id,"restaurantId","customerId","walletId","rewardId","rewardName","pointsCost","cashCents",code,status,"createdAt","usedAt","usedUnitId") values (gen_random_uuid(),'${rid}','${c}','${w}','${r}','${name}',${pts},${cash},'${code}','${status}',now()-interval '${daysAgo} days',${status === 'USED' ? `now()-interval '${daysAgo} days' + interval '1 hour'` : 'null'},${status === 'USED' ? `'${uid}'` : 'null'})`);
red(lucas, wl, rBrownie, 'Brownie', 500, 0, 'AAA111', 'PENDING', 0);
red(ana, wa, rCafe, 'Café coado', 150, 300, 'BBB222', 'PENDING', 1);
red(lucas, wl, rBrownie, 'Brownie', 500, 0, 'CCC333', 'USED', 2);
red(ana, wa, rBrownie, 'Brownie', 500, 0, 'DDD444', 'USED', 20);
for (let i = 0; i < 30; i++) red(lucas, wl, rCafe, 'Café coado', 150, 300, `ZZ${String(i).padStart(4, '0')}`, 'USED', 40 + i);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');

// 1. abre em "Para entregar" com os 2 pendentes e o botão Entregar; contagens nas abas
await o.goto(BASE + '/dashboard/resgates'); await o.waitForSelector('[data-testid=resgate-row]');
assert.equal(await o.locator('[data-testid=resgate-row]').count(), 2);
assert.ok(await o.locator('text=AAA111').count()); assert.ok(await o.locator('text=BBB222').count());
assert.ok(await o.locator('text=/Cobrar R\\$\\s*3,00 no balcão/').count());
assert.match(await o.locator('nav[aria-label="Situação"]').innerText(), /Para entregar\s*2[\s\S]*Entregues\s*32[\s\S]*Todos\s*34/);
console.log('1. Para entregar: 2 pendentes, valor a cobrar e contagens nas abas OK');

// 2. Entregues: 32; busca por cliente e por prêmio; paginação de 25
await o.goto(BASE + '/dashboard/resgates?st=entregues'); await o.waitForSelector('[data-testid=resgate-row]');
assert.equal(await o.locator('[data-testid=resgate-row]').count(), 25);
assert.match(await o.locator('[data-testid=resgates-resumo]').innerText(), /32 resgates/);
await o.click('nav[aria-label="Páginas"] a:has-text("Próximos")'); await o.waitForURL('**pg=2**');
assert.equal(await o.locator('[data-testid=resgate-row]').count(), 7);
await o.goto(BASE + '/dashboard/resgates?st=entregues&q=ana'); await o.waitForSelector('[data-testid=resgate-row]');
assert.equal(await o.locator('[data-testid=resgate-row]').count(), 1); assert.ok(await o.locator('text=DDD444').count());
await o.goto(BASE + '/dashboard/resgates?st=entregues&q=brownie');
assert.equal(await o.locator('[data-testid=resgate-row]').count(), 2);
console.log('2. entregues paginados e busca por cliente e prêmio OK');

// 3. período: de/até e atalhos (últimos 7 dias pega só o de 2 dias atrás)
await o.goto(BASE + '/dashboard/resgates?st=todos'); await o.waitForSelector('[data-testid=resgate-row]');
await o.click('[aria-label="Períodos rápidos"] a:has-text("Últimos 7 dias")'); await o.waitForURL('**de=*');
assert.equal(await o.locator('[data-testid=resgate-row]').count(), 3, 'AAA, BBB e CCC nos últimos 7 dias');
assert.ok(await o.locator('[data-testid=resgates-resumo] :text("filtrado")').count());
await o.click('a:has-text("Limpar filtros")'); await o.waitForURL((u) => !u.search.includes('de='));
console.log('3. períodos rápidos e limpar filtros OK');

// 4. exportação respeita os filtros (mesma sessão do painel)
const csv = async (qs) => (await (await o.request.get(`${BASE}/dashboard/resgates/exportar${qs}`)).text()).replace(/^﻿/, '');
const all = await csv('?st=todos');
assert.equal(all.trim().split('\n').length, 1 + 34);
assert.match(all.split('\n')[0], /Código.*Prêmio.*Cliente.*CPF.*Situação/);
const onlyAna = await csv('?st=todos&q=ana');
assert.equal(onlyAna.trim().split('\n').length, 1 + 2);
assert.ok(onlyAna.includes('BBB222') && onlyAna.includes('DDD444') && !onlyAna.includes('AAA111'));
assert.match(onlyAna, /\*\*\*\./, 'CPF mascarado');
const pend = await csv('');
assert.equal(pend.trim().split('\n').length, 1 + 2);
const link = await o.getAttribute('[data-testid=export-resgates]', 'href');
assert.ok(link.startsWith('/dashboard/resgates/exportar'));
console.log('4. exportar CSV com os filtros e CPF mascarado OK');

// 5. entregar continua funcionando e a contagem muda
await o.goto(BASE + '/dashboard/resgates'); await o.waitForSelector('button:has-text("Entregar")');
await o.locator('li:has-text("AAA111") button:has-text("Entregar")').click();
for (let i = 0; i < 40 && sql(`select status from "Redemption" where code='AAA111'`) !== 'USED'; i++) await o.waitForTimeout(250);
assert.equal(sql(`select status from "Redemption" where code='AAA111'`), 'USED');
await o.reload(); await o.waitForSelector('[data-testid=resgate-row]');
assert.equal(await o.locator('[data-testid=resgate-row]').count(), 1);
console.log('5. entregar atualiza a lista OK');

await b.close();
console.log('ALL OK (resgates)');
