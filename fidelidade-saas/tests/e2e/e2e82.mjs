// Identidade (verde-floresta e dourado, sem degradê): botão principal no verde de ação (texto branco, 40 px), botão branco nas faixas escuras, câmera, aba ativa, barras e marcador em cor chapada, e nenhuma lima sobrando.
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

// 1. página inicial: botão principal no verde de ação, texto branco, 40 px
await p.goto(BASE + '/'); await wait(p, 1500);
const cta = p.locator('a:has-text("Começar agora")').first();
const st = await cta.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, fg: c.color, h: e.getBoundingClientRect().height }; });
assert.equal(st.bg, 'rgb(30, 91, 67)', 'fundo no verde de ação (#1E5B43)');
assert.equal(st.fg, 'rgb(255, 255, 255)', 'texto branco');
assert.ok(st.h >= 39.5 && st.h <= 41, `botão discreto, 40 px de altura (${st.h})`);
console.log('1. botão principal: verde #1E5B43, texto branco, 40 px OK');

// 2. faixa escura: botão branco com texto verde-floresta
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(p, 500);
const dark = p.locator('a:has-text("Quero fidelizar meus clientes")').last();
const sd = await dark.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, fg: c.color }; });
assert.equal(sd.bg, 'rgb(255, 255, 255)', 'sobre o verde-floresta o botão é branco'); assert.equal(sd.fg, 'rgb(18, 36, 28)', 'texto verde-floresta');
console.log('2. faixa escura: botão branco com texto verde-floresta OK');

// 3. nenhuma lima e nenhum degradê no CSS dos elementos de marca
const rules = await css(p);
const all = rules.map((r) => r[1]).join('\n');
assert.ok(rules.length > 200 && /nav-float-fab/.test(all), `leu o CSS inteiro (${rules.length} regras)`);
assert.ok(!/c6f432|198, ?244, ?50|b3e01c|f1fbc8/i.test(all), 'nenhuma lima no CSS');
const text = (sel) => rules.filter(([s]) => s.split(',').map((x) => x.trim()).includes(sel)).map((r) => r[1]).join(' ').toLowerCase();
for (const sel of ['.nav-float-fab', '.bar-grad', '.mark-ouro']) assert.ok(text(sel).length > 0 && !/gradient/.test(text(sel)), `${sel}: cor chapada, sem degradê`);
assert.ok(rules.some(([s, t]) => s.includes('.nav-float-item[aria-current="page"]') && !/gradient/.test(t)), 'aba ativa em cor chapada');
console.log('3. sem lima no CSS; câmera, aba ativa, barras e marcador em cor chapada OK');

// 4. cores: verde de ação na câmera e nas barras; dourado no marcador do título
for (const sel of ['.nav-float-fab', '.bar-grad']) assert.ok(/30, ?91, ?67|1e5b43/.test(text(sel)), `${sel}: verde de ação #1E5B43`);
assert.ok(/233, ?196, ?106|e9c46a/.test(text('.mark-ouro')), 'marcador dourado #E9C46A');
console.log('4. verde de ação #1E5B43 e marcador dourado #E9C46A OK');

// 5. páginas públicas e entrar, sem rolagem lateral no celular
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
await m.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const mp = await m.newPage();
for (const path of ['/', '/precos', '/entrar', '/login']) { await mp.goto(BASE + path); await wait(mp, 900); assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `celular ${path}`); }
console.log('5. celular: início, preços, entrar e login sem rolagem lateral OK');

await browser.close();
console.log('ALL OK (cores do logo)');
