// Indicações, moderação: o dono do lugar vê as indicações sobre o negócio e denuncia; a administração vê a denúncia com a foto,
// esconde (some do feed dos clientes) ou mantém (encerra as denúncias); a foto é servida a admin e dono, não a anônimos.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const PNG = `decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64')`;
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`delete from "AdminLog"; delete from "AdminUser"`);
sql(`insert into "AdminUser"(id,email,name,"passwordHash",active) select gen_random_uuid(),'admin@teste.com','Admin',"passwordHash",true from "Restaurant" where email='ze@burger.com'`);
sql(`truncate "RateLimit"; delete from "PostReport"; delete from "PostLike"; delete from "PostPhoto"; delete from "Post"`);
const mk = (rating, comment) => {
  const id = sql(`insert into "Post"(id,"customerId","restaurantId",rating,comment) values (gen_random_uuid()::text,'${lucas}','${rid}',${rating},'${comment}') returning id`).split('\n')[0];
  sql(`insert into "PostPhoto"("postId",mime,data) values ('${id}','image/png',${PNG})`);
  return id;
};
const p1 = mk(2, 'Foto de outro lugar'), p2 = mk(5, 'Muito bom');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1100, height: 800 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const O = await ctx.newPage(); O.on('pageerror', (e) => console.log('PAGEERROR', e.message));

// 1. dono: atalho no Início e tela com as indicações do negócio
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
await O.waitForSelector('[data-testid=posts-shortcut]');
assert.match(await O.locator('[data-testid=posts-shortcut]').innerText(), /2 fotos/);
await O.click('[data-testid=posts-shortcut]'); await O.waitForURL('**/dashboard/indicacoes'); await O.waitForSelector('[data-testid=owner-post]');
assert.equal(await O.locator('[data-testid=owner-post]').count(), 2);
assert.equal((await O.request.get(BASE + `/api/indicacoes/foto/${p1}`)).status(), 200, 'o dono do lugar vê a foto');
console.log('1. dono vê as indicações do negócio OK');

// 2. dono denuncia a primeira (precisa de motivo)
const card = O.locator('[data-testid=owner-post]', { hasText: 'Foto de outro lugar' });
await card.locator('[data-testid=owner-report-open]').click();
await card.locator('[data-testid=owner-report-send]').click(); await O.waitForSelector('text=Conte o motivo');
await card.locator('textarea').fill('Não é do meu restaurante');
await card.locator('[data-testid=owner-report-send]').click(); await card.locator('[data-testid=post-reported]').waitFor();
assert.equal(sql(`select count(*) from "PostReport" where "postId"='${p1}' and "reporterRestaurantId"='${rid}'`), '1');
assert.equal(sql(`select "reportedAt" is not null from "Post" where id='${p1}'`), 't');
console.log('2. dono denuncia com motivo OK');

// 3. anônimo não vê a foto; a foto não vaza
const anon = await b.newContext();
assert.equal((await anon.request.get(BASE + `/api/indicacoes/foto/${p1}`)).status(), 401);
await anon.close();

// 4. administração: vê a denúncia com a foto, o motivo e quem denunciou; selo no menu
const actx = await b.newContext({ viewport: { width: 1100, height: 800 } });
await actx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const A = await actx.newPage();
await A.goto(BASE + '/admin/entrar'); await A.fill('#email', 'admin@teste.com'); await A.fill('#password', 'senha-segura-1'); await A.click('button[type=submit]'); await A.waitForURL('**/admin');
await A.goto(BASE + '/admin/indicacoes'); await A.waitForSelector('[data-testid=admin-post]');
assert.equal(await A.locator('[data-testid=admin-post]').count(), 1);
const txt = await A.locator('[data-testid=admin-post]').innerText();
assert.match(txt, /Dono do lugar/); assert.match(txt, /Não é do meu restaurante/); assert.match(txt, /Foto de outro lugar/);
assert.match(await A.locator('nav a[href="/admin/indicacoes"]').innerText(), /1/, 'selo de pendências');
assert.equal((await A.request.get(BASE + `/api/indicacoes/foto/${p1}`)).status(), 200, 'admin vê a foto');
console.log('3. e 4. foto privada; administração vê a denúncia, o motivo e a foto OK');

// 5. cliente também denuncia a outra; administração mantém uma e esconde a outra
sql(`insert into "PostReport"(id,"postId","reporterCustomerId",reason) values (gen_random_uuid()::text,'${p2}','${lucas}','Spam'); update "Post" set "reportedAt"=now() where id='${p2}'`);
await A.reload(); await A.waitForSelector('[data-testid=admin-post]');
assert.equal(await A.locator('[data-testid=admin-post]').count(), 2);
await A.locator('[data-testid=admin-post]', { hasText: 'Muito bom' }).locator('[data-testid=keep-post]').click(); await A.waitForFunction(() => document.querySelectorAll('[data-testid=admin-post]').length === 1);
assert.equal(sql(`select ("reportedAt" is null)::text||'|'||(select count(*) from "PostReport" where "postId"='${p2}') from "Post" where id='${p2}'`), 'true|0');
await A.locator('[data-testid=admin-post]', { hasText: 'Foto de outro lugar' }).locator('[data-testid=hide-post]').click();
await A.waitForSelector('text=Nenhuma denúncia pendente');
assert.equal(sql(`select ("hiddenAt" is not null)::text from "Post" where id='${p1}'`), 'true');
assert.match(sql(`select action from "AdminLog" where action like '%indicação' order by "createdAt" desc limit 1`), /ocultar indicação/);
console.log('5. administração mantém uma e esconde a outra (com registro) OK');

// 6. escondida some do feed dos clientes e das telas do dono; a foto vira 404 para outros
await O.goto(BASE + '/dashboard/indicacoes'); await O.waitForSelector('[data-testid=owner-post]');
assert.equal(await O.locator('[data-testid=owner-post]').count(), 1);
assert.equal((await O.request.get(BASE + `/api/indicacoes/foto/${p1}`)).status(), 404);
const cctx = await b.newContext({ viewport: { width: 1100, height: 800 } });
await cctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const C = await cctx.newPage();
await C.goto(BASE + '/entrar'); await C.fill('#c-email', 'lucas@teste.com'); await C.fill('#c-password', 'senha-cliente-1'); await C.click('button[type=submit]'); await C.waitForURL('**/carteira**');
await C.goto(BASE + '/indicacoes'); await C.waitForSelector('[data-testid=feed]');
assert.equal(await C.locator(`[data-post-id="${p1}"]`).count(), 1, 'o autor ainda vê a própria, marcada');
assert.match(await C.locator(`[data-post-id="${p1}"]`).innerText(), /Escondida pela moderação/);
console.log('6. escondida: some para o dono e os outros, o autor vê marcada OK');

sql(`delete from "PostReport"; delete from "Post"`);
await b.close();
