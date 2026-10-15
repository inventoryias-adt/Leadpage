import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; delete from "Customer" where email in ('termos@teste.com','termos2@teste.com') or cpf='12345678909'; delete from "Restaurant" where email='termos-dono@teste.com'`);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
await ctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const noOverflow = async (what) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${what}: sem rolagem lateral`);

// 1. páginas legais: dois termos + privacidade
await p.goto(BASE + '/termos'); await p.waitForSelector('h1:has-text("Termos de Uso")');
assert.ok(await p.locator('a[href="/termos/estabelecimento"]').count() && await p.locator('a[href="/termos/cliente"]').count(), 'o índice leva aos dois termos');
await p.goto(BASE + '/termos/estabelecimento'); await p.waitForSelector('h1:has-text("Termos de Uso para Estabelecimentos")');
for (const t of ['Assinatura, preço e pagamento', 'R$ 69,90', 'Dados dos seus clientes', 'Lançar pelo CPF', 'Campanhas do app e pontos compartilhados']) assert.ok(await p.locator(`text=${t}`).count(), 'estabelecimento: ' + t);
assert.equal(await p.locator('text=Não são dinheiro').count(), 0, 'o termo do estabelecimento não mistura o do cliente');
assert.ok(await p.locator('a[href^="mailto:suporte@exemplo.com"]').count(), 'termos mostram o e-mail de suporte');
await noOverflow('termos estabelecimento'); await p.screenshot({ path: 'leg-termos.png', fullPage: true });
await p.goto(BASE + '/termos/cliente'); await p.waitForSelector('h1:has-text("Termos de Uso do Cliente")');
for (const t of ['Não são dinheiro', 'Como você ganha pontos', 'Pontos compartilhados entre lugares', 'Localização e endereços', 'Agendamentos e reservas']) assert.ok(await p.locator(`text=${t}`).count(), 'cliente: ' + t);
assert.equal(await p.locator('text=Assinatura, preço e pagamento').count(), 0, 'o termo do cliente não fala de assinatura do estabelecimento');
await noOverflow('termos cliente');
await p.goto(BASE + '/privacidade'); await p.waitForSelector('h1:has-text("Política de Privacidade")');
for (const t of ['LGPD', 'Seus direitos', 'Quais dados tratamos']) assert.ok(await p.locator(`text=${t}`).count(), t);
await noOverflow('privacidade');
console.log('1. dois termos de uso + privacidade publicados, com contato e sem rolagem lateral OK');

// 2. cada tela mostra o termo de quem está nela
await p.goto(BASE + '/');
assert.ok(await p.locator('a[href="/termos/estabelecimento"]').count() && await p.locator('a[href="/termos/cliente"]').count() && await p.locator('a[href="/privacidade"]').count(), 'landing: os dois');
await p.goto(BASE + '/entrar');
assert.ok(await p.locator('a[href="/termos/cliente"]').count() && await p.locator('a[href="/privacidade"]').count(), 'entrar: termo do cliente');
assert.equal(await p.locator('a[href="/termos/estabelecimento"]').count(), 0, 'entrar não mostra o do estabelecimento');
await p.goto(BASE + '/login');
assert.ok(await p.locator('a[href="/termos/estabelecimento"]').count() && await p.locator('a[href="/privacidade"]').count(), 'login: termo do estabelecimento');
assert.equal(await p.locator('a[href="/termos/cliente"]').count(), 0, 'login não mostra o do cliente');
console.log('2. termos certos na landing (os dois), entrar (cliente) e login (estabelecimento) OK');

// 3. cadastro do dono exige o aceite (navegador e servidor) e grava a prova
await p.goto(BASE + '/');
await p.fill('#name', 'Termos Dono'); await p.fill('#email', 'termos-dono@teste.com'); await p.fill('#phone', '11912345678'); await p.fill('#password', 'senha-segura-1');
assert.equal(await p.locator('#accept-owner').isChecked(), false, 'a caixa começa desmarcada');
assert.equal(await p.locator('label[for=accept-owner] a').first().getAttribute('href'), '/termos/estabelecimento', 'o aceite do dono leva ao termo do estabelecimento');
assert.equal(await p.evaluate(() => document.querySelector('#accept-owner').validity.valueMissing), true, 'o navegador exige a caixa');
await p.evaluate(() => document.querySelector('#accept-owner').removeAttribute('required')); // força o servidor a decidir
await p.click('text=Ir para pagamento seguro');
await p.waitForSelector('text=aceite os Termos de Uso');
assert.equal(sql(`select count(*) from "Restaurant" where email='termos-dono@teste.com'`), '0', 'sem aceite não cria a conta');
await p.fill('#password', 'senha-segura-1'); await p.check('#accept-owner'); await p.click('text=Ir para pagamento seguro'); await p.waitForURL('**/pagamento/simulado');
const rec = sql(`select ("termsAcceptedAt" is not null)::text||'|'||coalesce("termsVersion",'') from "Restaurant" where email='termos-dono@teste.com'`);
assert.match(rec, /^true\|\d{4}-\d{2}-\d{2}$/);
console.log('3. cadastro do dono: exige aceite e grava data e versão OK');

// 4. cadastro do cliente
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.click('[role=tab]:has-text("Criar conta")');
await c.fill('#s-name', 'Termos Cliente'); await c.fill('#s-cpf', '123.456.789-09'); await c.fill('#s-phone', '11988887777'); await c.fill('#s-email', 'termos@teste.com'); await c.fill('#s-password', 'senha-termos-1');
assert.equal(await c.locator('label[for=accept-customer] a').first().getAttribute('href'), '/termos/cliente', 'o aceite do cliente leva ao termo do cliente');
await c.evaluate(() => document.querySelector('#accept-customer').removeAttribute('required'));
await c.click('button[type=submit]:has-text("Criar")');
await c.waitForSelector('text=aceite os Termos de Uso');
assert.equal(sql(`select count(*) from "Customer" where email='termos@teste.com'`), '0');
await c.fill('#s-password', 'senha-termos-1'); await c.check('#accept-customer'); await c.click('button[type=submit]:has-text("Criar")'); await c.waitForURL('**/carteira**');
assert.match(sql(`select ("termsAcceptedAt" is not null)::text||'|'||coalesce("termsVersion",'') from "Customer" where email='termos@teste.com'`), /^true\|\d{4}-\d{2}-\d{2}$/);
console.log('4. cadastro do cliente: exige aceite e grava data e versão OK');
sql(`delete from "Customer" where email='termos@teste.com'; delete from "Restaurant" where email='termos-dono@teste.com'`);
await b.close();
console.log('ALL OK (termos e privacidade)');
