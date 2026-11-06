// Ações para ganhar pontos: a barra mostra o G do Google e o Instagram; as linhas usam os mesmos ícones;
// "Avaliação 5 estrelas no Google" (texto antigo) aparece como "Avaliação no Google".
process.env.FZ_SECTIONS = 'closed';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();

sql('truncate "RateLimit"');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`update "Restaurant" set listed=true, "checkInPoints"=10, "onboardedAt"=coalesce("onboardedAt",now()) where id='${rid}'`);
sql(`delete from "InteractionRule" where "restaurantId"='${rid}' and (label ilike '%google%' or label ilike '%instagram%')`);
sql(`insert into "InteractionRule"(id,"restaurantId",label,points,approval) values (gen_random_uuid(),'${rid}','Foto no Instagram marcando o estabelecimento',50,'COUNTER'), (gen_random_uuid(),'${rid}','Avaliação 5 estrelas no Google',100,'COUNTER')`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await c.goto(BASE + '/lugar/' + rid); await c.waitForSelector('#acoes');

// 1. barra fechada: G do Google (4 cores) e Instagram (degradê) no lugar da estrelinha
const icons = c.locator('#acoes > h2 [data-testid=acoes-icones]');
assert.equal(await icons.count(), 1, 'ícones na barra');
assert.equal(await icons.locator('svg').count(), 2, 'dois ícones: Google e Instagram');
const fills = await icons.locator('svg').first().locator('path').evaluateAll((ps) => ps.map((p) => p.getAttribute('fill')));
assert.deepEqual(fills, ['#EA4335', '#4285F4', '#FBBC05', '#34A853'], 'G do Google nas cores da marca');
assert.equal(await c.locator('#acoes > h2 .icon-tile').count(), 0, 'sem a estrelinha antiga na barra');
console.log('1. barra com o G do Google e o Instagram OK');

// 2. aberta: linha do Google com o G e o título sem "5 estrelas"; Instagram com o ícone dele
await c.locator('#acoes > h2 > button').click();
await c.waitForSelector('#acoes >> text=Avaliação no Google');
const body = await c.locator('#acoes').innerText();
assert.ok(!/5 estrelas/i.test(body), 'sem "5 estrelas"');
const row = c.locator('#acoes li', { hasText: 'Avaliação no Google' });
assert.equal(await row.locator('.icon-tile svg path[fill="#4285F4"]').count(), 1, 'G do Google na linha');
assert.equal(await c.locator('#acoes li', { hasText: 'Foto no Instagram' }).locator('.icon-tile svg linearGradient').count(), 1, 'ícone do Instagram na linha');
console.log('2. linhas com os ícones das marcas e o título "Avaliação no Google" OK');

// 3. celular: sem rolagem lateral
assert.equal(await c.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'sem rolagem lateral');
console.log('3. celular sem rolagem lateral OK');
await b.close();
console.log('ALL OK (ícones das ações)');
