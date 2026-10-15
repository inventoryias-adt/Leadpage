// Raio do check-in configurável: o dono escolhe em Regras e o cliente nunca vê o número.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const wait = (p, t) => p.waitForTimeout(t);
const SE = { lat: -23.5505, lng: -46.6333 }; // ponto da unidade
const STREET = { latitude: -23.5507, longitude: -46.6335 }; // ~30 m dele (calçada)
sql('truncate "RateLimit"');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`update "Restaurant" set "checkInPoints"=5, "checkInRadiusM"=10, listed=true, "onboardedAt"=coalesce("onboardedAt",now()) where id='${rid}'`);
sql(`update "Unit" set latitude=${SE.lat}, longitude=${SE.lng}, active=true where "restaurantId"='${rid}'`);
const clearCheckins = () => sql(`delete from "CheckIn" where "restaurantId"='${rid}'`);
clearCheckins();
const radius = () => sql(`select "checkInRadiusM" from "Restaurant" where id='${rid}'`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const init = () => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); };

// dono
const octx = await b.newContext({ viewport: { width: 1100, height: 900 } }); await octx.addInitScript(init);
const o = await octx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1');
await o.click('button[type=submit]'); await o.waitForURL('**/dashboard**');
const setRadius = async (value) => {
  await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('#e-rad');
  await o.selectOption('#e-rad', String(value));
  await o.click('form:has(#e-rad) button[type=submit]');
  for (let i = 0; i < 40 && radius() !== String(value); i++) await wait(o, 500);
  assert.equal(radius(), String(value));
};

// cliente, na calçada (~30 m)
const cctx = await b.newContext({ viewport: { width: 420, height: 900 }, geolocation: STREET, permissions: ['geolocation'] }); await cctx.addInitScript(init);
const c = await cctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1');
await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
const tryCheckIn = async () => {
  await c.goto(BASE + '/lugar/' + rid); await c.waitForSelector('button:has-text("Fazer check-in")', { timeout: 30000 });
  await c.click('button:has-text("Fazer check-in")');
  await c.waitForSelector('.glass-success, .glass-error', { timeout: 30000 });
  return (await c.locator('.glass-success, .glass-error').first().innerText()).trim();
};

// 1. padrão 10 m: o campo existe no painel e o cliente a ~30 m é recusado, sem número nenhum
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('#e-rad');
assert.equal(await o.locator('#e-rad').inputValue(), '10');
const opts = await o.locator('#e-rad option').allInnerTexts();
assert.ok(opts.length >= 5 && opts.some((t) => t.startsWith('10 m')) && opts.some((t) => t.startsWith('200 m')));
let msg = await tryCheckIn();
assert.match(msg, /dentro do local/); assert.doesNotMatch(msg, /\d/);
assert.equal(sql(`select count(*) from "CheckIn" where "restaurantId"='${rid}'`), '0');
console.log('1. padrão 10 m: a ~30 m é recusado, sem número na mensagem OK');

// 2. o dono aumenta para 50 m: o mesmo cliente agora consegue
await setRadius(50);
msg = await tryCheckIn();
assert.match(msg, /Check-in feito/);
assert.equal(sql(`select count(*) from "CheckIn" where "restaurantId"='${rid}'`), '1');
console.log('2. dono escolhe 50 m: o mesmo cliente agora faz o check-in OK');

// 3. volta para 10 m: recusa de novo (e o cliente continua sem ver o raio)
clearCheckins();
await setRadius(10);
msg = await tryCheckIn();
assert.match(msg, /dentro do local/);
for (const t of ['text=/\\b10 ?m\\b/', 'text=/\\b50 ?m\\b/']) assert.equal(await c.locator(t).count(), 0, 'cliente não vê o raio');
console.log('3. de volta aos 10 m: recusa de novo e o cliente não vê o raio OK');

sql(`update "Restaurant" set "checkInRadiusM"=10 where id='${rid}'`);
await b.close();
console.log('ALL OK (raio do check-in configurável)');
