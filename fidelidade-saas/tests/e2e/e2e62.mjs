// Primeiro mês R$ 39,90: landing, pagamento e pagamento simulado mostram a oferta só para quem nunca pagou.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));

// 1. landing: R$ 39,90 em destaque, "no primeiro mês" menor e o preço cheio depois
await p.goto(BASE + '/'); await p.waitForSelector('text=no primeiro mês');
const hero = await p.locator('main').innerText();
assert.match(hero, /R\$ 39,90/); assert.match(hero, /no primeiro mês/); assert.match(hero, /R\$ 69,90/);
const big = await p.locator('span:text-is("R$ 39,90")').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
const small = await p.locator('text=/^\\s*no primeiro mês/').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
assert.ok(big > small, `preço maior que o rótulo (${big} > ${small})`);
console.log('1. landing: R$ 39,90 grande, "no primeiro mês" menor e R$ 69,90 depois OK');

// 2. conta que nunca pagou: /pagamento mostra a oferta
await p.goto(BASE + '/login'); await p.fill('#email', 'ze@burger.com'); await p.fill('#password', 'senha-segura-1'); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard**');
sql(`update "Restaurant" set "subscriptionStatus"='PENDING', "paymentCustomerId"=null where email='ze@burger.com'`);
await p.goto(BASE + '/pagamento'); await p.waitForSelector('[data-testid=preco-primeiro-mes]');
const t = await p.locator('[data-testid=preco-primeiro-mes]').innerText();
assert.match(t, /R\$ 39,90/); assert.match(t, /no primeiro mês/); assert.match(t, /Depois, R\$ 69,90 por mês/);
console.log('2. conta nova: pagamento mostra R$ 39,90 no primeiro mês e R$ 69,90 depois OK');

// 3. pagamento simulado também cobra R$ 39,90 na primeira vez
await p.goto(BASE + '/pagamento/simulado'); await p.waitForSelector('button:has-text("Simular pagamento")');
assert.match(await p.locator('button:has-text("Simular pagamento")').innerText(), /R\$ 39,90/);
console.log('3. pagamento simulado: R$ 39,90 OK');

// 4. quem já foi cliente (cancelou ou atrasou) paga o preço cheio, sem oferta
for (const [status, customer] of [['CANCELED', "'cus_teste'"], ['PAST_DUE', "'cus_teste'"], ['PENDING', "'cus_teste'"]]) {
  sql(`update "Restaurant" set "subscriptionStatus"='${status}', "paymentCustomerId"=${customer} where email='ze@burger.com'`);
  await p.goto(BASE + '/pagamento'); await p.waitForSelector('text=/69/');
  assert.equal(await p.locator('[data-testid=preco-primeiro-mes]').count(), 0, `${status} sem oferta`);
  assert.match(await p.locator('main').innerText(), /R\$ 69,90|69,90\/mês|69.*,90\/mês/);
}
await p.goto(BASE + '/pagamento/simulado'); assert.match(await p.locator('button:has-text("Simular pagamento")').innerText(), /R\$ 69,90/);
console.log('4. quem já foi cliente paga R$ 69,90 cheio OK');

// 5. termos e página de interessados citam a oferta
await p.goto(BASE + '/termos/estabelecimento'); assert.match(await p.locator('main, body').first().innerText(), /primeiro mês sai por R\$ 39,90/);
await p.goto(BASE + '/quero-o-fidelize'); assert.match(await p.locator('body').innerText(), /primeiro mês sai por R\$ 39,90; depois, R\$ 69,90/);
console.log('5. termos e página de interessados com a oferta OK');

sql(`update "Restaurant" set "subscriptionStatus"='ACTIVE', "paymentCustomerId"=null where email='ze@burger.com'`);
await b.close();
console.log('ALL OK (primeiro mês R$ 39,90)');
