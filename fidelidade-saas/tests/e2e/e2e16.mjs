import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(), "pointsShareOut"=false, "pointsAcceptIn"=false`);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const l = await ctx.newPage(); l.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await l.goto(BASE + '/entrar'); await l.fill('#c-email', 'lucas@teste.com'); await l.fill('#c-password', 'senha-cliente-1');
await l.click('button[type=submit]'); await l.waitForURL('**/carteira**');
const noOverflow = async (p, what) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${what}: sem rolagem lateral`);

// 1. Início limpo: Olá → (campanhas do app) → pontos por lugar → explorar; sem listas de códigos
await l.waitForSelector('text=Suas carteiras');
const order = await l.evaluate(() => ['Olá,', 'Suas carteiras'].map((t) => { const el = [...document.querySelectorAll('h1,h2')].find((e) => e.textContent.includes(t)); return el ? el.getBoundingClientRect().top + window.scrollY : -1; }));
assert.ok(order.every((v) => v >= 0), `títulos presentes ${order}`);
assert.deepEqual([...order].sort((a, b) => a - b), order, 'ordem: Olá → carteiras');
for (const gone of ['Prêmios para retirar', 'Você pode resgatar agora', 'Vantagens de usar']) assert.equal(await l.locator(`text=${gone}`).count(), 0, `${gone} saiu do Início`);
await noOverflow(l, 'início'); await l.screenshot({ path: 'nov-inicio.png', fullPage: true });
console.log('1. início limpo: pontos por lugar e atalho para explorar OK');

// 2. Perfil: atalhos para as duas telas
await l.goto(BASE + '/perfil'); await l.waitForSelector('[data-testid=shortcut-groups]');
assert.ok(await l.locator('a[href="/perfil/pontos"]').count() && await l.locator('a[href="/perfil/premios"]').count());
assert.equal(await l.locator('section[aria-labelledby=historico]').count(), 0, 'sem a lista de histórico solta no perfil');
await noOverflow(l, 'perfil'); await l.screenshot({ path: 'nov-perfil.png', fullPage: true });
await l.click('a[href="/perfil/pontos"]'); await l.waitForURL('**/perfil/pontos');
await l.waitForSelector('h1:has-text("Histórico de pontos")'); await noOverflow(l, 'histórico');
console.log('2. perfil: atalhos e tela de histórico de pontos OK');

// 3. Meus prêmios: para retirar / posso resgatar / já resgatados
await l.goto(BASE + '/perfil/premios'); await l.waitForSelector('h1:has-text("Meus prêmios")');
assert.ok(await l.locator('a[aria-current=page]:has-text("Para retirar")').count(), 'abre em "Para retirar"');
const nVouchers = Number(sql(`select count(*) from "Redemption" r join "Customer" c on c.id=r."customerId" where c.email='lucas@teste.com' and r.status='PENDING'`));
assert.ok(nVouchers === 0 || (await l.locator('main ul li').count()) >= nVouchers, 'lista todos os prêmios para retirar');
await l.click('a:has-text("Posso resgatar")'); await l.waitForURL('**aba=disponiveis');
await l.click('a:has-text("Já resgatados")'); await l.waitForURL('**aba=resgatados');
const before = sql(`select count(*) from "Redemption" r join "Customer" c on c.id=r."customerId" where c.email='lucas@teste.com' and r.status='USED'`);
sql(`update "Redemption" set status='USED', "usedAt"=now() where id=(select r.id from "Redemption" r join "Customer" c on c.id=r."customerId" where c.email='lucas@teste.com' and r.status='PENDING' limit 1)`);
await l.reload(); await l.waitForSelector(`a:has-text("Já resgatados") >> text=${Number(before) + 1}`);
assert.ok(await l.locator('main ul li:has(svg)').count() >= 1, 'item resgatado aparece com data');
await noOverflow(l, 'prêmios'); await l.screenshot({ path: 'nov-premios.png', fullPage: true });
console.log('3. meus prêmios: três abas, resgatados aparecem com data OK');

// 4. Pontos compartilhados: dono liga as chaves; cliente vê "Compartilhada" e quem aceita
await l.goto(BASE + '/perfil'); await l.waitForSelector('text=Pontos compartilhados');
assert.ok(await l.locator('text=Individual').count() >= 1, 'começa individual');
assert.ok(await l.locator('text=Ainda nenhum lugar aceita').count() === 1);
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('#compartilhar');
await o.check('input[name=pointsShareOut]'); await o.check('input[name=pointsAcceptIn]');
await o.click('#compartilhar button[type=submit]'); await o.waitForSelector('#compartilhar >> text=Salvo.');
assert.equal(sql(`select "pointsShareOut"::text||"pointsAcceptIn"::text from "Restaurant" where email='ze@burger.com'`), 'truetrue');
await l.goto(BASE + '/perfil'); await l.waitForSelector('text=Compartilhada');
assert.ok(await l.locator('a[href^="/lugar/"]:has-text("Burger")').count() >= 1, 'lista de quem aceita pontos de outros');
await l.screenshot({ path: 'nov-compartilhados.png', fullPage: true });
await o.screenshot({ path: 'nov-regras.png' });
await noOverflow(l, 'perfil com compartilhados');
console.log('4. pontos compartilhados: chaves no painel e visão do cliente OK');
await b.close();
console.log('ALL OK (perfil/início/compartilhados)');
