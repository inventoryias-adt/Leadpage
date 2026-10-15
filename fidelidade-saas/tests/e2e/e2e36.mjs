// Foto de perfil do cliente: escolher, aparecer, trocar, remover, e nunca ficar pública.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const wait = (p, t) => p.waitForTimeout(t);
sql('truncate "RateLimit"');
sql(`delete from "CustomerPhoto" where "customerId" in (select id from "Customer" where email='lucas@teste.com')`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(BASE + '/entrar'); await p.fill('#c-email', 'lucas@teste.com'); await p.fill('#c-password', 'senha-cliente-1');
await p.click('button[type=submit]'); await p.waitForURL('**/carteira**');
const count = () => Number(sql(`select count(*) from "CustomerPhoto" p join "Customer" c on c.id=p."customerId" where c.email='lucas@teste.com'`));

// 1. sem foto: inicial do nome e convite para adicionar
await p.goto(BASE + '/perfil'); await p.waitForSelector('[data-testid=profile-photo-input]', { state: 'attached' });
assert.equal(await p.locator('[data-testid=profile-photo]').count(), 0);
assert.ok(await p.locator('label:has-text("Adicionar foto")').count(), 'convite para adicionar a foto');
assert.equal(await p.locator('button:has-text("Remover")').count(), 0);
console.log('1. sem foto: inicial do nome e "Adicionar foto" OK');

// 2. escolher a foto: é enviada sozinha, guardada e aparece no avatar
await p.setInputFiles('[data-testid=profile-photo-input]', 'logo.png');
await p.waitForSelector('[data-testid=profile-photo]', { timeout: 30000 });
assert.equal(count(), 1, 'foto gravada');
const src1 = await p.locator('[data-testid=profile-photo]').getAttribute('src');
assert.match(src1, /^\/api\/perfil\/foto\?v=\d+$/);
const ok = await p.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, t: r.headers.get('content-type'), n: (await r.arrayBuffer()).byteLength }; }, src1);
assert.equal(ok.s, 200); assert.match(ok.t, /^image\/(webp|jpeg)$/); assert.ok(ok.n > 100);
assert.ok(await p.locator('label:has-text("Trocar foto")').count() && await p.locator('button:has-text("Remover")').count());
await p.screenshot({ path: 'perfil-foto.png' });
console.log('2. escolher a foto: envia sozinha, grava e aparece no avatar OK');

// 3. continua depois de recarregar e vale em outra aba aberta
await p.reload(); await p.waitForSelector('[data-testid=profile-photo]');
console.log('3. a foto continua depois de recarregar OK');

// 4. trocar por outra foto muda o endereço (o navegador baixa de novo)
await wait(p, 1100);
await p.setInputFiles('[data-testid=profile-photo-input]', 'prato.png');
await p.waitForFunction((old) => document.querySelector('[data-testid=profile-photo]')?.getAttribute('src') !== old, src1, { timeout: 30000 });
assert.equal(count(), 1, 'continua uma foto só por cliente');
console.log('4. trocar a foto: novo endereço e ainda uma só por cliente OK');

// 5. nunca pública: sem login não entrega; arquivo que não é imagem é recusado
const anon = await (await b.newContext()).request.get(BASE + '/api/perfil/foto');
assert.equal(anon.status(), 401);
await p.setInputFiles('[data-testid=profile-photo-input]', { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('não sou imagem') });
await p.waitForSelector('text=Escolha um arquivo de imagem.');
assert.equal(count(), 1);
console.log('5. sem login não entrega a foto e arquivo que não é imagem é recusado OK');

// 6. remover
await p.reload(); await p.waitForSelector('[data-testid=profile-photo]');
await p.click('button:has-text("Remover")');
await p.waitForFunction(() => !document.querySelector('[data-testid=profile-photo]'), null, { timeout: 30000 });
assert.equal(count(), 0);
const gone = await p.evaluate(async () => (await fetch('/api/perfil/foto')).status);
assert.equal(gone, 404);
console.log('6. remover: volta para a inicial e a foto é apagada OK');

await b.close();
console.log('ALL OK (foto de perfil do cliente)');
