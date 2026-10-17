// Página do lugar (cliente): Ações, Campanhas e Desafios são menus que abrem ao toque, com resumo na linha fechada,
// setinha que pisca até abrir uma vez, estado lembrado, link #âncora que abre sozinho e cartões que mudam de cor ao passar o mouse.
process.env.FZ_SECTIONS = 'closed'; // o preload dos testes antigos abre tudo; aqui queremos ver o comportamento de fechado
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const wait = (p, t) => p.waitForTimeout(t);

sql('truncate "RateLimit"');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`update "Restaurant" set listed=true, "checkInPoints"=10, "referralPoints"=50, "onboardedAt"=coalesce("onboardedAt",now()) where id='${rid}'`);
sql(`delete from "Promotion" where "restaurantId"='${rid}'; delete from "Challenge" where "restaurantId"='${rid}'`);
sql(`insert into "Promotion"(id,"restaurantId",title,kind,multiplier,color) values (gen_random_uuid(),'${rid}','Terça em dobro','MULTIPLIER',2,'azul')`);
sql(`insert into "Challenge"(id,"restaurantId",title,kind,target,"minAmountCents",period,"bonusPoints",active) values (gen_random_uuid(),'${rid}','x','PURCHASES',2,4200,'WEEK',200,true)`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1180, height: 1000 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
const head = (id) => c.locator(`#${id} > h2 > button`);
const panel = (id) => c.locator(`#${id} [id][inert], #${id} > div`).last();

// 1. fechadas por padrão, com resumo na linha
await c.goto(BASE + '/lugar/' + rid); await c.waitForSelector('#acoes');
for (const id of ['acoes', 'promocoes', 'desafios']) assert.equal(await head(id).getAttribute('aria-expanded'), 'false', `${id} fechada`);
assert.match(await head('acoes').innerText(), /Ações para ganhar pontos[\s\S]*jeitos de ganhar · até \+50 pts/);
assert.match(await head('promocoes').innerText(), /Campanhas de pontos[\s\S]*1 campanha/);
assert.match(await head('desafios').innerText(), /Desafios da casa[\s\S]*1 desafio · bônus de até \+200 pts/);
assert.equal(await c.locator('#acoes [inert]').count(), 1, 'conteúdo fechado fica inerte');
console.log('1. Ações, Campanhas e Desafios vêm fechados, com um resumo em cada linha OK');

// 2. a setinha pisca até a pessoa abrir uma vez
assert.equal(await head('acoes').locator('.animate-ping').count(), 1, 'setinha piscando');
await head('acoes').click();
assert.equal(await head('acoes').getAttribute('aria-expanded'), 'true');
await c.waitForSelector('#acoes >> text=Check-in no local');
await head('acoes').click();
assert.equal(await head('acoes').getAttribute('aria-expanded'), 'false');
assert.equal(await head('acoes').locator('.animate-ping').count(), 0, 'depois de usar, para de piscar');
assert.equal(await head('desafios').locator('.animate-ping').count(), 1, 'as outras seções continuam chamando');
console.log('2. a setinha pisca até a primeira vez que a pessoa abre; abrir mostra o conteúdo OK');

// 3. o que ela deixa aberto fica lembrado ao recarregar
await head('promocoes').click();
await c.waitForSelector('#promocoes >> text=Terça em dobro');
await c.reload(); await c.waitForSelector('#promocoes');
assert.equal(await head('promocoes').getAttribute('aria-expanded'), 'true', 'campanhas continuam abertas');
assert.equal(await head('acoes').getAttribute('aria-expanded'), 'false');
assert.equal(await head('desafios').getAttribute('aria-expanded'), 'false');
console.log('3. a seção deixada aberta continua aberta ao recarregar OK');

// 4. link com #âncora (ex.: "Quero participar" numa campanha) abre a seção sozinho
await c.goto(BASE + '/lugar/' + rid + '#desafios'); await c.waitForSelector('#desafios');
await c.waitForFunction(() => document.querySelector('#desafios > h2 > button')?.getAttribute('aria-expanded') === 'true');
assert.ok(await c.locator('#desafios >> text=Toda compra aqui').isVisible());
console.log('4. um link com #desafios abre a seção sozinho OK');

// 5. passar o mouse muda a cor: cabeçalho vira marinho; linha de ação ganha azul claro
const bg = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);
await head('acoes').hover(); await wait(c, 400);
assert.equal(await bg(head('acoes')), 'rgb(15, 31, 61)', 'cabeçalho vira azul-marinho');
await c.mouse.move(5, 5); await wait(c, 400);
assert.notEqual(await bg(head('acoes')), 'rgb(15, 31, 61)', 'e volta ao branco quando o mouse sai');
await head('acoes').click(); await c.waitForSelector('#acoes >> text=Check-in no local');
const row = c.locator('#acoes li').first();
await row.hover(); await wait(c, 400);
assert.equal(await bg(row), 'rgb(238, 243, 253)', 'linha ganha azul bem claro');
console.log('5. passar o mouse troca as cores (cabeçalho marinho, linha azul clara) OK');

// 6. menos cores: etiquetas calmas (sem lima nem roxo) nas listas
const lime = await c.locator('#acoes .chip-lima, #desafios .chip-lima, #promocoes .chip-lima').count();
assert.equal(lime, 0, 'sem etiquetas lima nas listas');
assert.equal(await c.locator('#desafios .icon-tile[class*="7C3AED"]').count(), 0, 'sem o roxo do troféu');
console.log('6. listas com etiquetas azul-claras (sem lima e sem roxo) OK');

sql(`delete from "Promotion" where "restaurantId"='${rid}'; delete from "Challenge" where "restaurantId"='${rid}'`);
await b.close();
console.log('ALL OK (seções recolhíveis na página do lugar)');
