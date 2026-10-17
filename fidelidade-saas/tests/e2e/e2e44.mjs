import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));

// 1. cliente: o botão do assistente aparece e abre o aviso "em breve" com exemplos de perguntas
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await c.waitForSelector('[data-testid=assistant-fab]');
await c.click('[data-testid=assistant-fab]');
await c.waitForSelector('[role=dialog] :text("Em breve")');
assert.ok(await c.locator('[role=dialog] :text("Qual o lugar aberto mais perto de mim?")').count());
assert.equal(await c.locator('[role=dialog] :text("ticket médio")').count(), 0, 'cliente não vê as perguntas do dono');
await c.keyboard.press('Escape');
await c.waitForFunction(() => !document.querySelector('[role=dialog]'));
console.log('1. cliente: botão do assistente abre o "em breve" e fecha com Esc OK');

// 2. na tela do pedido o botão sai do caminho da sacola
const rid = (await c.evaluate(async () => (await (await fetch('/lugares')).text()).match(/\/lugar\/([0-9a-f-]{36})/)?.[1])) ?? null;
if (rid) { await c.goto(`${BASE}/lugar/${rid}/pedido`); await c.waitForTimeout(800); assert.equal(await c.locator('[data-testid=assistant-fab]').count(), 0); console.log('2. some na tela do pedido OK'); }

// 3. dono: botão com as perguntas do estabelecimento
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await o.waitForSelector('[data-testid=assistant-fab]');
await o.click('[data-testid=assistant-fab]');
await o.waitForSelector('[role=dialog] :text("ticket médio")');
assert.ok(await o.locator('[role=dialog] :text("relatório da última semana")').count());
await o.click('[role=dialog] button:has-text("Entendi")');
await o.waitForFunction(() => !document.querySelector('[role=dialog]'));
console.log('3. dono: perguntas do estabelecimento e fechar OK');

await b.close();
console.log('ALL OK (assistente em breve)');
