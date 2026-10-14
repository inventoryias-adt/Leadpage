import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; delete from "Notification"; delete from "Redemption"; delete from "Wallet" where "customerId"=(select id from "Customer" where email='lucas@teste.com')`);
const A = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`update "Restaurant" set "pointsPerReal"=10,"pointsShareOut"=true,"pointsAcceptIn"=false where id='${A}'`);
const B = sql(`insert into "Restaurant"(id,name,email,"passwordHash",phone,"subscriptionStatus","onboardedAt","pointsPerReal","pointsAcceptIn","createdAt") values (gen_random_uuid(),'Loja Parceira','parceira-${Date.now()}@t.com','x','11900000000','ACTIVE',now(),5,true,now()) returning id`).split('\n')[0];
sql(`insert into "Reward"(id,"restaurantId",name,"pointsCost") values (gen_random_uuid(),'${B}','Café grátis',100)`);
sql(`insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid(),'${cid}','${A}',500)`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');

await c.goto(BASE + `/lugar/${B}/premios`);
assert.ok(await c.locator('text=Completar com pontos de outros lugares').count(), 'oferece completar com pontos de outros');
assert.ok(await c.locator('text=valem 1.000 aqui').count() || await c.locator('text=valem 250 aqui').count(), 'mostra a conversão (500 pts de A valem 250 em B)');
assert.equal(await c.locator('button:has-text("Adicionar")').first().isDisabled(), true, 'sem marcar, não dá para adicionar (0 pts aqui)');
await c.check('label:has-text("Completar com pontos de outros lugares") input');
await c.click('button[aria-label="Adicionar Café grátis à sacola"]');
await c.screenshot({ path: 'compartilhados-sacola.png', fullPage: true });
await c.click('button:has-text("Resgatar sacola")'); await c.click('button:has-text("Confirmar")');
await c.waitForSelector('text=Resgate realizado!');
assert.equal(sql(`select balance from "Wallet" where "customerId"='${cid}' and "restaurantId"='${A}'`), '300', 'A: 500 − 200');
assert.equal(sql(`select balance from "Wallet" where "customerId"='${cid}' and "restaurantId"='${B}'`), '0');
assert.ok(sql(`select count(*) from "Notification" where body like '%Completamos com pontos de%'`) === '1');
console.log('1. sacola completa com pontos de outro lugar, convertidos pelo valor OK');

// histórico do cliente mostra a conversão
await c.goto(BASE + '/perfil/pontos');
assert.ok(await c.locator('text=Pontos vindos de').count() && await c.locator('text=Usados em Loja Parceira').count(), 'extrato mostra saída e entrada');
await c.goto(BASE + '/perfil');
assert.ok(await c.locator('text=completar o que faltar').count());
console.log('2. extrato e perfil explicam OK');

// lugar que NÃO aceita não mostra a opção
await c.goto(BASE + `/lugar/${A}/premios`);
assert.equal(await c.locator('text=Completar com pontos de outros lugares').count(), 0);
console.log('3. lugar que não aceita não oferece OK');

// dono de A não vê "emitidos" inflados: só EARN conta
assert.equal(sql(`select coalesce(sum(points),0) from "Transaction" t join "Wallet" w on w.id=t."walletId" where w."restaurantId"='${B}' and t.type='EARN'`), '0');
console.log('ALL OK (pontos compartilhados)');
sql(`delete from "Restaurant" where id='${B}'`);
await b.close();
