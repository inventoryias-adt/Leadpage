import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"pointsPerReal"=10; delete from "Notification"; delete from "Promotion"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const cust = sql(`select id||'|'||cpf from "Customer" where email='lucas@teste.com'`).split('|');
const cid = cust[0];
const cpfFmt = cust[1].replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
sql(`delete from "Wallet" where "customerId"='${cid}'; delete from "Claim" where "restaurantId"='${rid}'`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await o.goto(BASE + '/dashboard/caixa'); await o.waitForSelector('#cpf');

// 1. CPF de quem tem conta: nome abreviado e botão de lançar direto
await o.fill('#cpf', cpfFmt);
await o.waitForSelector('text=Conta encontrada');
assert.match(await o.locator('[aria-live=polite]').first().innerText(), /Conta encontrada:\s+\w+ \w\./);
assert.ok(await o.locator('[data-testid=lancar-direto]').count());
console.log('1. CPF com conta: nome abreviado e botão de lançar direto OK');

// 2. R$ 50,00 direto: 500 pontos, sem QR Code
await o.fill('#amount', '50,00');
await o.click('[data-testid=lancar-direto]');
await o.waitForSelector('text=pontos lançados para');
assert.equal(sql(`select balance from "Wallet" where "customerId"='${cid}' and "restaurantId"='${rid}'`), '500');
assert.equal(sql(`select ("redeemedAt" is not null)::text||'|'||("customerId"='${cid}')::text from "Claim" where "restaurantId"='${rid}' limit 1`), 'true|true');
assert.equal(sql(`select count(*) from "Transaction" t join "Wallet" w on w.id=t."walletId" where w."customerId"='${cid}' and t.type='EARN'`), '1');
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}'`), '1');
console.log('2. lançamento direto: carteira +500, extrato, aviso ao cliente e lançamento já consumido OK');

// 3. repetido em segundos: recusado
await o.click('button:has-text("Novo lançamento")');
await o.fill('#cpf', cpfFmt); await o.waitForSelector('text=Conta encontrada');
await o.fill('#amount', '50,00'); await o.click('[data-testid=lancar-direto]');
await o.waitForSelector('text=acabou de ser feito');
assert.equal(sql(`select balance from "Wallet" where "customerId"='${cid}' and "restaurantId"='${rid}'`), '500', 'não creditou duas vezes');
console.log('3. mesmo lançamento repetido em segundos é recusado OK');

// 4. CPF válido sem conta: orienta o QR Code, que segue funcionando
await o.fill('#cpf', '123.456.789-09');
await o.waitForSelector('text=ainda não tem conta');
assert.equal(await o.locator('[data-testid=lancar-direto]').count(), 0);
await o.fill('#amount', '30,00'); await o.click('button:has-text("Gerar QR Code")');
await o.waitForSelector('text=Uso único');
console.log('4. CPF sem conta: orienta o QR Code, e o QR segue funcionando OK');

// 5. CPF inválido
await o.fill('#cpf', '111.111.111-11');
await o.waitForSelector('text=CPF inválido. Confira');
console.log('5. CPF inválido avisado OK');

// 6. "Últimos lançamentos" mostra o creditado
await o.reload();
assert.ok(await o.locator('text=/Creditado a Lucas/').count());
console.log('ALL OK (lançar pontos pelo CPF)');
await b.close();
