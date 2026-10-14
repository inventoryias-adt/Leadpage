import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"`);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });

// 1. Abertura: toca com ?splash=1, some sozinha, não repete na sessão e é pulada em navegador automatizado
const c1 = await b.newContext({ viewport: { width: 400, height: 800 } });
const p = await c1.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(BASE + '/entrar?splash=1');
assert.ok(await p.locator('.splash').isVisible(), 'a abertura aparece');
assert.notEqual(await p.evaluate(() => document.documentElement.getAttribute('data-splash')), 'off');
assert.equal(await p.locator('.splash svg path').count() >= 2, true, 'o símbolo com a moeda está na abertura');
await p.waitForFunction(() => !document.querySelector('.splash'), null, { timeout: 8000 });
assert.equal(await p.evaluate(() => sessionStorage.getItem('fz_splash')), '1');
await p.goto(BASE + '/entrar'); // mesma sessão, sem o parâmetro
assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-splash')), 'off');
const auto = await c1.newPage(); await auto.goto(BASE + '/entrar');
assert.equal(await auto.evaluate(() => document.documentElement.getAttribute('data-splash')), 'off', 'navegador automatizado pula');
// a abertura não bloqueia cliques
const c2 = await b.newContext({ viewport: { width: 400, height: 800 } });
const q = await c2.newPage(); await q.goto(BASE + '/entrar?splash=1');
await q.click('text=Criar conta', { timeout: 3000 });
// reduzir movimento: não toca
const c3 = await b.newContext({ viewport: { width: 400, height: 800 }, reducedMotion: 'reduce' });
const r = await c3.newPage(); await r.goto(BASE + '/entrar');
assert.equal(await r.evaluate(() => document.documentElement.getAttribute('data-splash')), 'off');
// a landing não toca
const c4 = await b.newContext({ viewport: { width: 400, height: 800 } });
const l = await c4.newPage(); await l.goto(BASE + '/');
assert.equal(await l.evaluate(() => document.documentElement.getAttribute('data-splash')), 'off');
console.log('1. abertura: toca, some, não repete, pula na landing / automação / reduzir movimento e não bloqueia cliques OK');

// 2. Landing: blocos abaixo da dobra entram só ao rolar; cada um de um lado
const w = await (await b.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
await w.goto(BASE + '/');
const steps = w.locator('ol > li.rv').first();
assert.equal(await steps.getAttribute('data-in'), null, 'ainda não entrou');
assert.match(await steps.getAttribute('class'), /rv-left/);
assert.match(await w.locator('ol > li.rv').nth(1).getAttribute('class'), /rv-right/, 'o 2º vem da direita');
await steps.scrollIntoViewIfNeeded(); await w.waitForTimeout(300);
await w.waitForFunction(() => document.querySelector('ol > li.rv')?.hasAttribute('data-in'));
await w.waitForTimeout(1100);
assert.equal(await steps.evaluate((e) => getComputedStyle(e).opacity), '1');
const dirs = await w.evaluate(() => [...new Set([...document.querySelectorAll('.rv')].map((e) => [...e.classList].find((c) => c.startsWith('rv-'))))].sort());
assert.deepEqual(dirs, ['rv-bottom', 'rv-flip', 'rv-left', 'rv-right', 'rv-top', 'rv-zoom'], 'seis tipos de entrada na landing');
assert.equal(await w.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
console.log('2. landing: entradas por rolagem de seis tipos (cima, baixo, esquerda, direita, zoom, giro) OK');

// 3. Sem movimento: tudo aparece direto
const rm = await (await b.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'reduce' })).newPage();
await rm.goto(BASE + '/');
assert.equal(await rm.locator('ol > li.rv').first().evaluate((e) => getComputedStyle(e).opacity), '1');
// sem JavaScript também
const nj = await (await b.newContext({ viewport: { width: 1100, height: 760 }, javaScriptEnabled: false })).newPage();
await nj.goto(BASE + '/');
assert.equal(await nj.locator('ol > li.rv').first().evaluate((e) => getComputedStyle(e).opacity), '1');
console.log('3. reduzir movimento e sem JavaScript: conteúdo visível direto OK');

// 4. App do cliente: Início, Lugares e Perfil entram por rolagem e não ganham rolagem lateral
const ctx = await b.newContext({ viewport: { width: 390, height: 780 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); });
const a = await ctx.newPage(); a.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await a.goto(BASE + '/entrar'); await a.fill('#c-email', 'lucas@teste.com'); await a.fill('#c-password', 'senha-cliente-1'); await a.click('button[type=submit]'); await a.waitForURL('**/carteira**');
for (const path of ['/carteira', '/lugares', '/perfil']) {
  await a.goto(BASE + path);
  await a.waitForSelector('main .rv');
  const total = await a.locator('main .rv').count();
  assert.ok(total >= 3, path + ' tem blocos animados');
  for (let y = 0; y < (await a.evaluate(() => document.documentElement.scrollHeight)); y += 400) { await a.evaluate((y) => scrollTo(0, y), y); await a.waitForTimeout(80); }
  await a.waitForTimeout(1000);
  assert.equal(await a.locator('main .rv:not([data-in])').count(), 0, path + ': tudo entra ao rolar');
  assert.equal(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, path + ' sem rolagem lateral');
}
console.log('4. app do cliente (Início, Lugares, Perfil): entradas variadas, sem rolagem lateral OK');
await b.close();
console.log('ALL OK (moeda, abertura e rolagem)');
