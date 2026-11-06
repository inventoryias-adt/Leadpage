// Cores do logo: botão principal no azul do F (texto branco, 40 px), botão branco nas faixas escuras, degradê do logo na câmera, na aba ativa e nas barras, e nenhuma lima sobrando.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const wait = (p, ms) => p.waitForTimeout(ms);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
// Todas as regras do CSS (inclusive as de dentro de @media/@layer): [seletor, texto da regra].
const css = (page) => page.evaluate(() => {
  const out = [];
  const walk = (rules) => { for (const r of rules) { if (r.selectorText !== undefined) out.push([r.selectorText, r.cssText]); if (r.cssRules && r.cssRules.length) walk(r.cssRules); else if (r.selectorText === undefined) out.push(['', r.cssText]); } };
  for (const ss of document.styleSheets) { try { walk(ss.cssRules); } catch {} }
  return out;
});

// 1. página inicial: botão principal azul do logo, texto branco, 40 px
await p.goto(BASE + '/'); await wait(p, 1500);
const cta = p.locator('a:has-text("Começar agora")').first();
const st = await cta.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, fg: c.color, h: e.getBoundingClientRect().height }; });
assert.equal(st.bg, 'rgb(47, 99, 230)', 'fundo no azul do F (#2F63E6)');
assert.equal(st.fg, 'rgb(255, 255, 255)', 'texto branco');
assert.ok(st.h >= 39.5 && st.h <= 41, `botão discreto, 40 px de altura (${st.h})`);
console.log('1. botão principal: azul #2F63E6, texto branco, 40 px OK');

// 2. faixa escura: botão branco com texto marinho
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(p, 500);
const dark = p.locator('a:has-text("Quero fidelizar meus clientes")').last();
const sd = await dark.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, fg: c.color }; });
assert.equal(sd.bg, 'rgb(255, 255, 255)', 'sobre o marinho o botão é branco'); assert.equal(sd.fg, 'rgb(15, 31, 61)', 'texto marinho');
console.log('2. faixa escura: botão branco com texto marinho OK');

// 3. nenhuma lima no CSS e degradê do logo nos elementos sem texto
const rules = await css(p);
const all = rules.map((r) => r[1]).join('\n');
assert.ok(rules.length > 200 && /nav-float-fab/.test(all), `leu o CSS inteiro (${rules.length} regras)`);
assert.ok(!/c6f432|198, ?244, ?50|b3e01c|f1fbc8/i.test(all), 'nenhuma lima no CSS');
const has = (sel, re) => rules.some(([s, t]) => s.split(',').map((x) => x.trim()).includes(sel) && re.test(t));
assert.ok(has('.nav-float-fab', /linear-gradient/), 'botão da câmera em degradê');
assert.ok(has('.bar-grad', /linear-gradient/), 'barra de progresso em degradê');
assert.ok(has('.mark-grad', /linear-gradient/), 'marcador do título em degradê');
assert.ok(rules.some(([s, t]) => s.includes('.nav-float-item[aria-current="page"]') && /linear-gradient/.test(t)), 'aba ativa em degradê');
console.log('3. sem lima no CSS; câmera, aba ativa, barras e marcador em degradê do logo OK');

// 4. o degradê é do azul do F para o verde do F
for (const sel of ['.nav-float-fab', '.bar-grad']) {
  const t = rules.filter(([s]) => s.split(',').map((x) => x.trim()).includes(sel)).map((r) => r[1]).join(' ').toLowerCase();
  assert.ok(/47, ?99, ?230|2f63e6/.test(t) && /123, ?224, ?138|7be08a/.test(t), `${sel}: do azul #2F63E6 ao verde #7BE08A`);
}
console.log('4. degradê do azul #2F63E6 ao verde #7BE08A OK');

// 5. páginas públicas e entrar, sem rolagem lateral no celular
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
await m.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const mp = await m.newPage();
for (const path of ['/', '/precos', '/entrar', '/login']) { await mp.goto(BASE + path); await wait(mp, 900); assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `celular ${path}`); }
console.log('5. celular: início, preços, entrar e login sem rolagem lateral OK');

await browser.close();
console.log('ALL OK (cores do logo)');
