// O botão do Assistente ("em breve") fica escondido enquanto a função não existe: nem na carteira do cliente, nem no painel do dono.
// Quando NEXT_PUBLIC_ASSISTANT=1 ele volta (veja src/lib/features.ts).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));

// 1. cliente: carteira carrega e não há botão do assistente
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await c.waitForSelector('h1, h2', { state: 'attached' });
await c.waitForTimeout(800);
assert.equal(await c.locator('[data-testid=assistant-fab]').count(), 0, 'cliente não vê o assistente');
console.log('1. cliente: sem botão do assistente OK');

// 2. dono: painel carrega e não há botão do assistente
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await o.waitForSelector('h1, h2', { state: 'attached' });
await o.waitForTimeout(800);
assert.equal(await o.locator('[data-testid=assistant-fab]').count(), 0, 'dono não vê o assistente');
console.log('2. dono: sem botão do assistente OK');

await b.close();
console.log('ALL OK (assistente escondido)');
