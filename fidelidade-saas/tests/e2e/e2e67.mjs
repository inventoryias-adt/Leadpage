// Cartão do cliente no Perfil (estilo cartão de banco): frente com marca, ID da conta, nome e saldo; vira ao toque e mostra como usar;
// painel de saldo com "onde usar"; "Imprimir cartão" abre frente e verso no tamanho de cartão de crédito (85,6 mm).
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
// garante saldo para o cartão e para o "onde usar": a carteira do Lucas no Zé tem 1.250 pontos
sql(`insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid()::text,'${lucas}','${rid}',1250) on conflict ("customerId","restaurantId") do update set balance=1250`);
const total = Number(sql(`select coalesce(sum(balance),0) from "Wallet" where "customerId"='${lucas}'`));
const fmt = (n) => n.toLocaleString('pt-BR');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
const noOverflow = async (what) => assert.ok(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${what}: sem rolagem lateral`);

// 1. frente do cartão: proporção de cartão de crédito, marca, ID, nome e saldo
await c.goto(BASE + '/perfil'); await c.waitForSelector('[data-testid=account-id-code]');
const code = (await c.locator('[data-testid=account-id-code]').innerText()).trim();
assert.match(code, /^FZ-[A-HJ-NP-Z2-9]{6}$/);
const box = await c.locator('[data-testid=card-flip]').boundingBox();
assert.ok(Math.abs(box.width / box.height - 1.586) < 0.05, `proporção de cartão (${box.width}x${box.height})`);
const front = await c.locator('[data-testid=card-flip]').innerText();
assert.match(front, /fidelize/i); assert.match(front, /LUCAS/i); assert.match(front, /Membro desde/);
assert.equal((await c.locator('[data-testid=card-balance]').innerText()).replace(/\s*pts\s*$/, '').trim(), fmt(total), 'saldo no cartão = soma das carteiras');
await noOverflow('perfil');
console.log('1. frente do cartão: proporção de cartão, marca, ID', code, ', nome e saldo OK');

// 2. o cartão vira ao toque e mostra como usar; vira de volta
assert.equal(await c.locator('[data-testid=card-flip]').getAttribute('aria-pressed'), 'false');
await c.click('[data-testid=card-flip]'); await c.waitForTimeout(900);
assert.equal(await c.locator('[data-testid=card-flip]').getAttribute('aria-pressed'), 'true');
assert.match(await c.locator('[data-testid=card-flip]').textContent(), /Como usar[\s\S]*Informe o ID no caixa/);
const tf = () => c.locator('[data-testid=card-flip]').evaluate((e) => getComputedStyle(e).transform);
assert.notEqual(await tf(), 'none', 'cartão girado');
await c.click('[data-testid=card-flip]'); await c.waitForTimeout(900);
assert.equal(await c.locator('[data-testid=card-flip]').getAttribute('aria-pressed'), 'false');
assert.equal(await tf(), 'none', 'cartão de frente');
console.log('2. toque vira o cartão (como usar) e vira de volta OK');

// 3. painel de saldo: saldo, onde usar e atalhos
const panel = await c.locator('[data-testid=account-balance]').innerText();
assert.match(panel, new RegExp(`${fmt(total).replace('.', '\\.')}\\s+pontos`));
assert.match(panel, /onde usar/i);
assert.ok(await c.locator('[data-testid=account-balance] a[href^="/carteira/"]').count() >= 1, 'lugares onde usar');
assert.ok(await c.locator('[data-testid=account-balance] button:has-text("Copiar ID")').count() === 1);
console.log('3. painel de saldo com "onde usar", copiar ID e imprimir OK');

// 4. imprimir: tela com frente e verso; no modo de impressão só o cartão aparece, em 85,6 mm
await c.click('[data-testid=print-card-link]'); await c.waitForURL('**/perfil/cartao');
await c.waitForSelector('[data-testid=card-preview]');
assert.equal(await c.locator('[data-testid=card-preview] .card-face').count(), 2, 'frente e verso na prévia');
await noOverflow('cartão');
await c.emulateMedia({ media: 'print' });
await c.waitForSelector('.print-cards .pc-card');
const widths = await c.locator('.print-cards .pc-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
assert.deepEqual(widths.length, 2);
assert.ok(widths.every((w) => Math.abs(w - 323.5) <= 3), `85,6 mm em cada face (${widths})`);
assert.equal(await c.locator('main').isVisible(), false, 'no modo de impressão a página some');
assert.ok(await c.locator('.print-cards').isVisible());
// na impressão a frente tem fundo sólido e sem os enfeites de degradê com transparência (no PDF do iPhone eles apagavam o fundo e viravam uma faixa preta)
for (const face of await c.locator('.print-cards .card-face').all()) assert.equal(await face.evaluate((e) => getComputedStyle(e).backgroundColor), 'rgb(15, 36, 71)', 'fundo azul sólido na impressão');
assert.equal(await c.locator('.print-cards .card-deco').count() > 0, true);
for (const deco of await c.locator('.print-cards .card-deco').all()) assert.equal(await deco.evaluate((e) => getComputedStyle(e).display), 'none', 'sem enfeites na impressão');
await c.emulateMedia({ media: 'screen' });
assert.notEqual(await c.locator('.card-preview .card-deco, [data-testid=card-preview] .card-deco').first().evaluate((e) => getComputedStyle(e).display), 'none', 'na tela os enfeites continuam');
console.log('4. imprimir cartão: frente e verso em 85,6 mm, resto da página escondido OK');
await b.close();
