import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { execSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const MAIL = process.env.DEV_MAIL_FILE || '/tmp/dev-mail.jsonl';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql('truncate "RateLimit"; delete from "Lead"; delete from "AdminUser" where email=\'contatos@teste.com\'');
if (existsSync(MAIL)) rmSync(MAIL);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));

// 1. quem lê o QR Code cai em /entrar e vê o convite para comerciantes
await p.goto(BASE + '/entrar'); await p.waitForSelector('[data-testid=sou-comerciante]');
assert.match(await p.locator('[data-testid=sou-comerciante]').innerText(), /Tem um comércio\?/);
await p.click('[data-testid=sou-comerciante]'); await p.waitForURL('**/quero-o-fidelize?origem=qr');
await p.waitForSelector('#l-name'); await p.waitForTimeout(1200);
console.log('1. /entrar tem o atalho "Tem um comércio?" e leva ao formulário OK');

// 1b. o link do QR do cartaz (?criar=1) já abre na aba "Criar conta"
await p.goto(BASE + '/entrar?criar=1'); await p.waitForSelector('#s-name');
assert.ok(await p.locator('[role=tab][aria-selected=true]:has-text("Criar conta")').count());
await p.goto(BASE + '/entrar'); await p.waitForSelector('#c-email');
await p.goto(BASE + '/quero-o-fidelize?origem=qr'); await p.waitForSelector('#l-name'); await p.waitForTimeout(1200);
console.log('1b. /entrar?criar=1 abre direto em "Criar conta" OK');

// 2. validações com mensagem clara e os dados digitados voltam
await p.fill('#l-name', 'Maria Souza'); await p.fill('#l-business', 'Café da Maria'); await p.fill('#l-phone', '123'); await p.fill('#l-email', 'maria@cafe.com'); await p.fill('#l-city', 'São Paulo');
await p.selectOption('#l-category', 'cafe');
await p.click('[data-testid=lead-enviar]'); await p.waitForSelector('text=telefone com DDD');
assert.equal(sql('select count(*) from "Lead"'), '0');
assert.equal(await p.inputValue('#l-business'), 'Café da Maria', 'não perde o que digitou');
console.log('2. telefone inválido é recusado sem perder o que foi digitado OK');

// 3. envio certo: grava, mostra confirmação e avisa por e-mail
await p.waitForTimeout(800);
await p.fill('#l-phone', '(11) 91234-5678'); await p.selectOption('#l-state', 'SP');
await p.selectOption('#l-category', 'outros'); await p.waitForSelector('#l-other'); await p.fill('#l-other', 'Doceria');
await p.fill('#l-msg', 'Tenho duas lojas');
await p.click('[data-testid=lead-enviar]'); await p.waitForSelector('[data-testid=lead-ok]');
assert.equal(sql(`select count(*) from "Lead" where email='maria@cafe.com' and phone='11912345678' and source='qr' and category='outros' and "categoryOther"='Doceria' and state='SP' and status='NEW'`), '1');
for (let i = 0; i < 40 && sql(`select "emailSent"::text from "Lead" limit 1`) !== 'true'; i++) await p.waitForTimeout(250);
assert.equal(sql(`select "emailSent"::text from "Lead" limit 1`), 'true');
const mails = readFileSync(MAIL, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const m = mails.find((x) => /Novo interessado no Fidelize/.test(x.subject));
assert.ok(m, 'e-mail do contato enviado'); assert.equal(m.to, process.env.LEAD_EMAIL || process.env.SUPPORT_EMAIL || m.to);
assert.match(m.text, /Café da Maria/); assert.match(m.text, /Ramo: Outros · Doceria/); assert.match(m.text, /\(11\) 91234-5678/); assert.match(m.text, /wa\.me\/5511912345678/); assert.match(m.text, /Tenho duas lojas/);
console.log('3. contato gravado, confirmação na tela e e-mail com WhatsApp para o dono OK');

// 4. robô (campo-isca) e excesso de envios
await p.goto(BASE + '/quero-o-fidelize'); await p.waitForSelector('#l-name'); await p.waitForTimeout(1200);
await p.evaluate(() => { document.querySelector('input[name=website]').value = 'http://spam'; });
await p.fill('#l-name', 'Robô'); await p.fill('#l-business', 'Spam'); await p.fill('#l-phone', '(11) 91234-5678'); await p.fill('#l-email', 'robo@spam.com'); await p.fill('#l-city', 'X1'); await p.selectOption('#l-category', 'moda');
await p.click('[data-testid=lead-enviar]'); await p.waitForSelector('[data-testid=lead-ok]');
assert.equal(sql(`select count(*) from "Lead" where email='robo@spam.com'`), '0', 'o campo-isca não grava');
sql(`truncate "RateLimit"`);
for (let i = 0; i < 4; i++) {
  await p.goto(BASE + '/quero-o-fidelize'); await p.waitForSelector('#l-name'); await p.waitForTimeout(900);
  await p.fill('#l-name', 'Fulano'); await p.fill('#l-business', 'Loja ' + i); await p.fill('#l-phone', '(11) 91234-5678'); await p.fill('#l-email', 'mesmo@teste.com'); await p.fill('#l-city', 'Rio'); await p.selectOption('#l-category', 'moda');
  await p.click('[data-testid=lead-enviar]');
  if (i < 3) await p.waitForSelector('[data-testid=lead-ok]'); else await p.waitForSelector('text=Muitas tentativas');
}
assert.equal(sql(`select count(*) from "Lead" where email='mesmo@teste.com'`), '3', 'no máximo 3 por e-mail por dia');
console.log('4. campo-isca não grava e o excesso de envios é barrado OK');

// 5. atalho também no Perfil do cliente logado
const lucas = await ctx.newPage();
await lucas.goto(BASE + '/entrar'); await lucas.fill('#c-email', 'lucas@teste.com'); await lucas.fill('#c-password', 'senha-cliente-1'); await lucas.click('button[type=submit]'); await lucas.waitForURL('**/carteira**');
await lucas.goto(BASE + '/perfil'); await lucas.waitForSelector('[data-testid=sou-comerciante]');
assert.match(await lucas.getAttribute('[data-testid=sou-comerciante]', 'href'), /\/quero-o-fidelize\?origem=app/);
console.log('5. Perfil do cliente tem o atalho para comerciantes OK');

// 6. administração: lista, WhatsApp, marcar como contatado
const out = execSync(`cd ${fileURLToPath(new URL('../..', import.meta.url))} && DATABASE_URL=${DB}?schema=public APP_URL=${BASE} npx tsx scripts/admin-invite.ts contatos@teste.com "Contatos Teste"`).toString();
const link = out.match(/http\S+\/admin\/convite\/\S+/)[0];
const dctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await dctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const a = await dctx.newPage();
await a.goto(link); await a.waitForTimeout(1800);
await a.fill('#password', 'SenhaContatos2026'); await a.fill('#confirm', 'SenhaContatos2026'); await a.click('button:has-text("Criar senha")'); await a.waitForURL('**/admin');
await a.goto(BASE + '/admin/contatos'); await a.waitForSelector('[data-testid=lead-card]');
assert.equal(await a.locator('[data-testid=lead-card]').count(), 4, '4 novos (Maria + 3 do mesmo e-mail)');
const card = a.locator('[data-testid=lead-card]:has-text("Café da Maria")');
assert.match(await card.innerText(), /Doceria/); assert.match(await card.innerText(), /QR Code do cartaz/); assert.match(await card.innerText(), /e-mail enviado/);
assert.ok((await card.locator('a[href*="wa.me/5511912345678"]').count()) === 1);
assert.match(await a.locator('nav[aria-label="Administração"]').innerText(), /Contatos\s*4/);
await card.locator('button:has-text("Marcar como contatado")').click();
for (let i = 0; i < 40 && sql(`select status from "Lead" where business='Café da Maria'`) !== 'CONTACTED'; i++) await a.waitForTimeout(250);
assert.equal(sql(`select status from "Lead" where business='Café da Maria'`), 'CONTACTED');
await a.reload(); await a.waitForSelector('[data-testid=lead-card]');
assert.equal(await a.locator('[data-testid=lead-card]').count(), 3, 'sai da lista de novos');
await a.goto(BASE + '/admin/contatos?st=todos'); await a.waitForSelector('[data-testid=lead-card]:has-text("Contatado")');
assert.equal(await a.locator('[data-testid=lead-card]').count(), 4);
await a.screenshot({ path: 'admin-contatos.png', fullPage: true });
// quem não é administrador não vê a lista
const anon = await b.newContext(); const r = await anon.request.get(BASE + '/admin/contatos', { maxRedirects: 0 });
assert.ok([302, 303, 307, 308].includes(r.status()));
console.log('6. admin vê os contatos, chama no WhatsApp e marca como contatado; sem login não entra OK');
await p.screenshot({ path: 'quero-fidelize.png', fullPage: true });
await b.close();
console.log('ALL OK (interessados)');
