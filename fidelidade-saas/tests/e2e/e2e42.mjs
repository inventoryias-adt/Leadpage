import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"pointsPerReal"=10; delete from "Promotion"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`delete from "Wallet" where "customerId"='${cid}'; delete from "Claim" where "restaurantId"='${rid}'`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));

// 1. o cliente vê o ID da conta no Perfil (FZ- + 6 caracteres) e ele é gravado
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await c.goto(BASE + '/perfil'); await c.waitForSelector('[data-testid=account-id-code]');
const code = (await c.locator('[data-testid=account-id-code]').innerText()).trim();
assert.match(code, /^FZ-[A-HJ-NP-Z2-9]{6}$/, 'formato do ID');
assert.equal(sql(`select "accountCode" from "Customer" where id='${cid}'`), code);
console.log('1. Perfil mostra o ID da conta', code, 'OK');

// 2. o caixa digita o ID (minúsculo e sem hífen também vale): acha o cliente pelo nome abreviado
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await o.goto(BASE + '/dashboard/caixa'); await o.waitForSelector('#cpf');
await o.fill('#cpf', code.toLowerCase().replace('-', ''));
await o.waitForSelector('text=Conta encontrada');
assert.match(await o.locator('[aria-live=polite]').first().innerText(), /Conta encontrada:\s+\w+ \w\./);
console.log('2. Caixa acha o cliente pelo ID OK');

// 3. lança R$ 40,00 pelo ID: 400 pontos na carteira
await o.fill('#amount', '40,00');
await o.click('[data-testid=lancar-direto]');
await o.waitForSelector('text=pontos lançados para');
assert.equal(sql(`select balance from "Wallet" where "customerId"='${cid}' and "restaurantId"='${rid}'`), '400');
console.log('3. Lançamento pelo ID: carteira +400 OK');

// 4. ID que não existe: aviso claro, sem lançar
await o.click('button:has-text("Novo lançamento")');
await o.fill('#cpf', 'FZ-ZZZZZZ');
await o.waitForSelector('text=Nenhuma conta com este ID');
assert.equal(await o.locator('[data-testid=lancar-direto]').count(), 0);
console.log('4. ID inexistente: aviso e sem botão de lançar OK');

// 5. CPF continua funcionando no mesmo campo
const cpf = sql(`select cpf from "Customer" where id='${cid}'`);
await o.fill('#cpf', cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'));
await o.waitForSelector('text=Conta encontrada');
console.log('5. CPF segue valendo no mesmo campo OK');

// 6. a lista de clientes encontra pelo ID
await o.goto(BASE + '/dashboard/clientes?q=' + encodeURIComponent(code));
await o.waitForSelector('text=Lucas');
assert.equal(await o.locator('li:has-text("Lucas")').count() > 0, true);
console.log('6. Clientes: busca pelo ID OK');

// 7. conta sem ID (anterior ao recurso) ganha o ID ao abrir o Perfil
sql(`update "Customer" set "accountCode"=null where id='${cid}'`);
await c.goto(BASE + '/perfil'); await c.waitForSelector('[data-testid=account-id-code]');
assert.match(sql(`select "accountCode" from "Customer" where id='${cid}'`), /^FZ-[A-HJ-NP-Z2-9]{6}$/);
console.log('7. Conta antiga ganha o ID na primeira visita OK');

await b.close();
console.log('ALL OK (ID da conta)');
