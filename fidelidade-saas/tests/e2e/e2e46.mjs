import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });

// 1. os dois manifestos: o do gestor abre o painel, o do cliente abre a carteira, com ids e nomes diferentes
const api = await b.newContext();
const g = await (await api.request.get(BASE + '/gestor.webmanifest')).json();
const c = await (await api.request.get(BASE + '/manifest.webmanifest')).json();
assert.equal(g.start_url, '/dashboard'); assert.equal(g.id, '/dashboard'); assert.match(g.name, /Gestor/); assert.equal(g.display, 'standalone');
assert.equal(c.start_url, '/carteira'); assert.notEqual(g.name, c.name); assert.notEqual(g.icons[0].src, c.icons[0].src);
for (const icon of g.icons) assert.equal((await api.request.get(BASE + icon.src)).status(), 200, `ícone ${icon.src}`);
assert.equal((await api.request.get(BASE + '/gestor-apple-touch-icon.png?v=1')).status(), 200);
console.log('1. manifestos separados: gestor →', g.start_url, '| cliente →', c.start_url, 'OK');

// 2. cada tela aponta para o manifesto certo
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const manifestOf = (pg) => pg.evaluate(() => [document.querySelector('link[rel=manifest]')?.getAttribute('href'), document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'), document.querySelector('meta[name=apple-mobile-web-app-title]')?.getAttribute('content')]);
await p.goto(BASE + '/login'); await p.waitForSelector('#email');
assert.deepEqual((await manifestOf(p)).map((x) => x?.split('?')[0]), ['/gestor.webmanifest', '/gestor-apple-touch-icon.png', 'Fidelize Gestor']);
assert.ok(await p.locator('section[aria-label="Adicionar à tela inicial"]:has-text("Fidelize Gestor")').count(), 'convite do gestor no login');
await p.goto(BASE + '/entrar'); await p.waitForSelector('#c-email');
assert.equal((await manifestOf(p))[0], '/manifest.webmanifest');
assert.ok(await p.locator('section[aria-label="Adicionar à tela inicial"]:has-text("Tenha o Fidelize na tela inicial")').count(), 'convite do cliente no /entrar');
console.log('2. /login → manifesto do gestor, /entrar → manifesto do cliente OK');

// 3. painel no celular: manifesto do gestor, convite próprio, guia com o nome certo
await p.goto(BASE + '/login'); await p.fill('#email', 'ze@burger.com'); await p.fill('#password', 'senha-segura-1'); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard');
assert.deepEqual((await manifestOf(p)).map((x) => x?.split('?')[0]), ['/gestor.webmanifest', '/gestor-apple-touch-icon.png', 'Fidelize Gestor']);
await p.waitForSelector('section[aria-label="Adicionar à tela inicial"]:has-text("Tenha o Fidelize Gestor na tela inicial")');
await p.click('section[aria-label="Adicionar à tela inicial"] button:has-text("Adicionar à tela inicial")');
await p.waitForSelector('[role=dialog]:has-text("o Fidelize Gestor fica no seu celular")');
await p.keyboard.press('Escape');
console.log('3. painel no celular: manifesto e convite do gestor OK');

// 4. o painel inteiro funciona no celular: barra de baixo e nenhuma tela com rolagem lateral
await p.evaluate(() => { try { localStorage.setItem('fz_install_collapsed_v1:gestor', '1'); } catch {} });
for (const path of ['/dashboard', '/dashboard/caixa', '/dashboard/agenda', '/dashboard/clientes', '/dashboard/pedidos', '/dashboard/resgates', '/dashboard/cardapio', '/dashboard/configuracoes']) {
  await p.goto(BASE + path); await p.waitForSelector('main, h1, h2', { state: 'attached' }); await p.waitForTimeout(500);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 1, `${path} tem rolagem lateral (${over}px)`);
}
assert.ok(await p.locator('nav a[href="/dashboard/caixa"]').count(), 'barra do painel com Caixa');
console.log('4. painel sem rolagem lateral no celular (8 telas) OK');

// 5. as telas do cliente continuam com o manifesto do cliente
const cc = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE, isMobile: true, hasTouch: true });
await cc.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const q = await cc.newPage();
await q.goto(BASE + '/entrar'); await q.fill('#c-email', 'lucas@teste.com'); await q.fill('#c-password', 'senha-cliente-1'); await q.click('button[type=submit]'); await q.waitForURL('**/carteira**');
assert.equal((await manifestOf(q))[0], '/manifest.webmanifest');
console.log('5. app do cliente segue com o manifesto do cliente OK');

await b.close();
console.log('ALL OK (app do gestor)');
