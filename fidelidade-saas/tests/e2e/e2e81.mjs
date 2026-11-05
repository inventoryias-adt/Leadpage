// Site público (e2e81): menu com Pontos, Desafios, Instagram e Preços; uma página por recurso com a maquete do app; Preços com o cartão de lançamento.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const wait = (p, ms) => p.waitForTimeout(ms);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const noOverflow = async (page, what) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${what}: sem rolagem lateral`);

// 1. a página inicial tem o menu com as quatro páginas
await p.goto(BASE + '/'); await wait(p, 1500);
const nav = p.locator('[data-testid="public-nav"]');
for (const t of ['Pontos', 'Desafios', 'Instagram', 'Preços']) assert.ok(await nav.locator(`nav >> a:text-is("${t}")`).first().isVisible(), `menu: ${t}`);
console.log('1. início: menu com Pontos, Desafios, Instagram e Preços OK');

// 2. cada página abre, tem título, maquete do app e menu com a aba atual marcada
const pages = [
  ['/pontos', 'Pontos de fidelidade', 'Seus pontos'],
  ['/desafios', 'Desafios e campanhas', 'Compre 3x esta semana'],
  ['/instagram', 'Instagram e divulgação', 'Já fiz'],
  ['/precos', 'Preços', 'Preço de lançamento'],
];
for (const [path, title, mark] of pages) {
  await nav.locator(`nav >> a[href="${path}"]`).first().click();
  await p.waitForURL('**' + path); await wait(p, 900);
  assert.equal((await p.locator('h1').first().innerText()).trim(), title, `${path}: título`);
  assert.ok(await p.locator(`text=${mark}`).first().count(), `${path}: ${mark}`);
  assert.equal(await p.locator('[data-testid="public-nav"] nav >> a[aria-current="page"]').first().getAttribute('href'), path, `${path}: aba atual`);
  await noOverflow(p, path);
  await p.goto(BASE + '/'); await wait(p, 600);
}
console.log('2. quatro páginas abrem com título, maquete do app e aba atual marcada, sem rolagem lateral OK');

// 3. Preços: só o cartão de lançamento (sem "planos em breve"), com R$ 39,90 e depois R$ 69,90
await p.goto(BASE + '/precos'); await wait(p, 800);
const card = await p.locator('[data-testid="plano-lancamento"]').innerText();
assert.match(card, /R\$ 39,90/); assert.match(card, /no primeiro mês/); assert.match(card, /R\$ 69,90/); assert.match(card, /Sem taxa de adesão/);
assert.equal(await p.locator('text=/em breve/i').count(), 0, 'sem "em breve"');
console.log('3. preços: cartão de lançamento com R$ 39,90 e depois R$ 69,90, sem "em breve" OK');

// 4. "Começar" de outra página leva ao cadastro da inicial já com o primeiro campo em foco
await p.goto(BASE + '/pontos'); await wait(p, 800);
await p.locator('[data-testid="public-nav"] a:text-is("Começar")').click();
await p.waitForURL('**/#assinar'); await wait(p, 1800);
assert.equal(await p.evaluate(() => document.activeElement?.id), 'name', 'foca o nome do estabelecimento');
console.log('4. começar de outra página cai no cadastro com o primeiro campo em foco OK');

// 5. celular: menu vira fileira rolável e nenhuma página vaza
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
await m.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const mp = await m.newPage();
for (const path of ['/', '/pontos', '/desafios', '/instagram', '/precos']) { await mp.goto(BASE + path); await wait(mp, 900); await noOverflow(mp, 'celular ' + path); }
console.log('5. celular: cinco páginas sem rolagem lateral OK');

// 6. sitemap lista as páginas novas
const sm = await (await fetch(BASE + '/sitemap.xml')).text();
for (const path of ['/pontos', '/desafios', '/instagram', '/precos']) assert.ok(sm.includes(path), `sitemap: ${path}`);
console.log('6. sitemap inclui as quatro páginas OK');

await browser.close();
console.log('ALL OK (site público)');
