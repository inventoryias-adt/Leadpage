import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),listed=true; delete from "Promotion"; delete from "Redemption"; delete from "Booking"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`delete from "Reward" where "restaurantId"='${rid}'; insert into "Reward"(id,"restaurantId",name,"pointsCost") values (gen_random_uuid(),'${rid}','Burger grátis',100)`);
const rw = sql(`select id from "Reward" where "restaurantId"='${rid}' limit 1`);
sql(`delete from "Wallet" where "customerId"='${cid}'; insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid(),'${cid}','${rid}',500)`);
const wid = sql(`select id from "Wallet" where "customerId"='${cid}'`);
sql(`insert into "Redemption"(id,"restaurantId","customerId","walletId","rewardId","rewardName","pointsCost",code,status) values (gen_random_uuid(),'${rid}','${cid}','${wid}','${rw}','Burger grátis',100,'ABC123','PENDING')`);
sql(`insert into "Promotion"(id,"restaurantId",title,kind,multiplier,weekdays,audience,active) values (gen_random_uuid(),'${rid}','Pontos em dobro','MULTIPLIER',2,'{}','ALL',true)`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(BASE + '/entrar'); await p.fill('#c-email', 'lucas@teste.com'); await p.fill('#c-password', 'senha-cliente-1'); await p.click('button[type=submit]'); await p.waitForURL('**/carteira**');

// 1. Início limpo: sem lista de códigos nem "resgatar agora"; os avisos ficam no cartão do lugar
assert.equal(await p.locator('text=Prêmios para retirar').count(), 0);
assert.equal(await p.locator('text=Você pode resgatar agora').count(), 0);
assert.equal(await p.locator('text=ABC123').count(), 0, 'o código não fica solto no Início');
const card = p.locator('a[href^="/carteira/"]:has-text("Burger do Zé")');
assert.ok(await card.locator('text=1 para retirar').count() && await card.locator('text=Pode resgatar').count());
await card.click(); await p.waitForURL('**/carteira/' + rid);
await p.waitForSelector('text=ABC123'); // o código aparece na página do lugar
console.log('1. Início limpo: avisos por lugar (para retirar / pode resgatar) e o código só na página do lugar OK');

// 2. Lugares: título enxuto, sem a frase antiga
await p.goto(BASE + '/lugares');
assert.equal(await p.locator('text=Encontre onde ganhar pontos').count(), 0);
assert.equal(await p.locator('text=Escolha onde você está').count(), 0);
console.log('2. Lugares sem as frases de cima OK');

// 3. busca em tela própria
await p.click('button:has-text("Buscar lugar ou categoria")');
await p.waitForSelector('[role=dialog][aria-label="Buscar lugares"]');
assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Buscar lugares', 'o campo já abre com o cursor');
assert.ok(await p.locator('[role=dialog] >> text=Explorar por categoria').count());
await p.keyboard.type('burger');
await p.waitForSelector('[role=dialog] a:has-text("Burger do Zé")');
await p.click('[role=dialog] button:has-text("Ver na lista")');
assert.equal(await p.locator('[role=dialog][aria-label="Buscar lugares"]').count(), 0);
assert.ok(await p.locator('button:has-text("burger")').count(), 'a busca fica na barra');
await p.click('button[aria-label="Limpar busca"]');
await p.keyboard.press('Escape');
console.log('3. busca em tela própria: campo com cursor, resultados, "Ver na lista" e limpar OK');

// 4. ordem: categorias antes das campanhas; campanhas por lugar com contagem
await p.goto(BASE + '/lugares');
const yCat = (await p.locator('[aria-label="Categorias"]').boundingBox()).y;
const yCamp = (await p.locator('section[aria-labelledby=campanhas]').boundingBox()).y;
assert.ok(yCat < yCamp, 'categorias vêm antes das campanhas');
assert.ok(await p.locator('section[aria-labelledby=campanhas]').locator('text=Burger do Zé').count());
const n = await p.locator('section[aria-labelledby=campanhas] button:has-text("campanha")').first().innerText();
assert.match(n, /\d+ campanhas?/);
await p.click('section[aria-labelledby=campanhas] button:has-text("campanha")');
await p.waitForSelector('[role=dialog]:has-text("Pontos em dobro")');
assert.ok(await p.locator('[role=dialog] a:has-text("Ver o lugar")').count());
await p.keyboard.press('Escape');
console.log('4. categorias antes das campanhas; campanhas por lugar com contagem e janela ' + '(' + n.trim() + ') OK');

// 5. formas ovais
const radius = (sel) => p.locator(sel).first().evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius));
assert.ok((await radius('button[aria-pressed]:has-text("Tudo")')) >= 100, 'filtros em pílula');
assert.ok((await radius('button:has-text("Buscar lugar ou categoria")')) >= 100, 'busca em pílula');
console.log('5. filtros e busca em formato oval OK');

// 6. carrosséis deixam claro que deslizam
assert.ok(await p.locator('[aria-label="Categorias"] >> text=Deslize para ver mais').count(), 'aviso escrito');
assert.ok(await p.locator('button[aria-label="Categorias: próximos"]').isVisible(), 'seta no celular');
assert.equal(await p.locator('button[aria-label="Categorias: anteriores"]').count(), 0, 'no começo não há seta para trás');
await p.locator('[aria-label="Categorias"] ul').evaluate((e) => (e.scrollLeft = 200));
await p.waitForSelector('button[aria-label="Categorias: anteriores"]');
assert.equal(await p.locator('[aria-label="Categorias"] >> text=Deslize para ver mais').count(), 0, 'o aviso some depois da 1ª rolagem');
await p.click('button[aria-label="Categorias: próximos"]');
console.log('6. carrosséis: seta, barra de posição e aviso "Deslize" (some ao rolar) OK');
await p.screenshot({ path: 'lugares-novo.png' });
console.log('ALL OK (início e lugares)');
await b.close();
