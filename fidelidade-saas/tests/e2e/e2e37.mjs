// Ação "Foto no Instagram": o cliente copia o @ do lugar (para marcar na foto) ou abre o perfil.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql('truncate "RateLimit"');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const oldInsta = sql(`select coalesce(instagram,'') from "Restaurant" where id='${rid}'`);
sql(`update "Restaurant" set instagram='burgerdoze', listed=true where id='${rid}'`);
if (!sql(`select count(*) from "InteractionRule" where "restaurantId"='${rid}' and active and label ilike '%instagram%'`) || sql(`select count(*) from "InteractionRule" where "restaurantId"='${rid}' and active and label ilike '%instagram%'`) === '0') {
  sql(`insert into "InteractionRule"(id,"restaurantId",label,points,active) values (gen_random_uuid(),'${rid}','Foto no Instagram marcando o restaurante',50,true)`);
}

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(BASE + '/entrar'); await p.fill('#c-email', 'lucas@teste.com'); await p.fill('#c-password', 'senha-cliente-1');
await p.click('button[type=submit]'); await p.waitForURL('**/carteira**');

await p.goto(BASE + '/lugar/' + rid);
const copy = p.locator('button:has-text("Copiar @burgerdoze")');
await copy.waitFor({ timeout: 30000 });
const open = p.locator('a:has-text("Abrir Instagram")');
assert.equal(await open.getAttribute('href'), 'https://instagram.com/burgerdoze');
console.log('1. ação do Instagram mostra "Copiar @burgerdoze" e "Abrir Instagram" OK');

await copy.click();
await p.waitForSelector('button:has-text("Copiado! Cole na sua foto")');
assert.equal(await p.evaluate(() => navigator.clipboard.readText()), '@burgerdoze');
console.log('2. tocar em copiar põe o @ na área de transferência e avisa OK');

await p.waitForSelector('button:has-text("Copiar @burgerdoze")', { timeout: 10000 });
console.log('3. o aviso volta ao normal sozinho OK');

// sem Instagram cadastrado: nenhum dos dois botões
sql(`update "Restaurant" set instagram=null where id='${rid}'`);
await p.reload(); await p.waitForSelector('text=Foto no Instagram');
assert.equal(await p.locator('button:has-text("Copiar @")').count(), 0);
assert.equal(await p.locator('a:has-text("Abrir Instagram")').count(), 0);
console.log('4. sem Instagram cadastrado, a ação aparece sem botões OK');

sql(`update "Restaurant" set instagram=${oldInsta ? `'${oldInsta}'` : 'null'} where id='${rid}'`);
await b.close();
console.log('ALL OK (copiar o Instagram do lugar)');
