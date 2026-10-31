// Regras como central: a tela inicial mostra o que está pronto e o que falta, com um cartão por assunto; cada assunto abre numa tela própria
// (voltar, próximo assunto, só o formulário daquele assunto); os links antigos por etapa continuam funcionando; o exemplo de pontos muda ao vivo.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(), "pointsPerReal"=10 where email='ze@burger.com'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`update "Reward" set active=false where "restaurantId"='${rid}'; delete from "Challenge" where "restaurantId"='${rid}'; delete from "Promotion" where "restaurantId"='${rid}'`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
const noOverflow = async (what) => assert.ok(await o.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${what}: sem rolagem lateral`);

// 1. a central mostra o que falta; sem prêmio o item fica "Falta fazer" e o próximo passo leva até ele
await o.goto(BASE + '/dashboard/configuracoes'); await o.waitForSelector('[data-testid=hub-progress]');
assert.equal((await o.locator('[data-testid=hub-premios-status]').innerText()).trim(), 'Falta fazer');
assert.match(await o.locator('[data-testid=hub-pontos]').innerText(), /R\$ 1 = 10 pontos/);
assert.match(await o.locator('[data-testid=hub-count]').innerText(), /^\d de 4$/);
assert.ok(await o.locator('[data-testid=hub-preview]').getAttribute('href').then((h) => h.startsWith('/lugar/')));
await noOverflow('central');
console.log('1. a central mostra o progresso, o resumo de cada assunto e o que falta OK');

// 2. cadastrar prêmio no assunto Prêmios; ao voltar, o item vira "Pronto"
sql(`insert into "Reward"(id,"restaurantId",name,"pointsCost","cashCents",active) values (gen_random_uuid(),'${rid}','Sobremesa',500,0,true)`);
await o.goto(BASE + '/dashboard/configuracoes'); await o.waitForSelector('[data-testid=hub-progress]');
assert.equal((await o.locator('[data-testid=hub-premios-status]').innerText()).trim(), 'Pronto');
assert.match(await o.locator('[data-testid=hub-premios]').innerText(), /1 prêmio/);
console.log('2. depois de cadastrar o prêmio, o item muda para Pronto e mostra o resumo OK');

// 3. um assunto abre numa tela própria, com voltar e próximo, e só com o formulário dele
await o.click('[data-testid=hub-pontos]'); await o.waitForSelector('[data-testid=topico-header]');
await o.waitForSelector('#pontos');
assert.match(await o.locator('h1').innerText(), /Pontos por compra/);
for (const id of ['#campanhas', '#desafios', '#engajamento', '#interacoes']) assert.equal(await o.locator(id).count(), 0, `${id} não aparece neste assunto`);
assert.equal(await o.locator('nav[aria-label="Seções"]').count(), 0, 'sem menu de etapas dentro de um assunto');
assert.ok(await o.locator('[data-testid=topico-proximo]').count() && await o.locator('[data-testid=topico-nav]').count());
await noOverflow('assunto');
console.log('3. cada assunto tem a sua tela, com voltar e próximo, sem o resto da etapa OK');

// 4. o exemplo de pontos acompanha o que é digitado
assert.match(await o.locator('[data-testid=points-sim]').innerText(), /500 pontos/);
assert.match(await o.locator('[data-testid=points-sim]').innerText(), /Sobremesa.*R\$\s*50,00/s);
await o.fill('#r-ppr', '20');
await o.waitForFunction(() => /1\.000 pontos/.test(document.querySelector('[data-testid=points-sim]')?.textContent ?? ''));
assert.match(await o.locator('[data-testid=points-sim]').innerText(), /R\$\s*25,00/);
await o.click('button:has-text("Salvar regras")');
for (let i = 0; i < 40 && sql(`select "pointsPerReal" from "Restaurant" where id='${rid}'`) !== '20'; i++) await o.waitForTimeout(250);
assert.equal(sql(`select "pointsPerReal" from "Restaurant" where id='${rid}'`), '20');
console.log('4. o exemplo de pontos e o prêmio mais barato mudam ao vivo, e salvar funciona OK');

// 5. próximo assunto e voltar
await o.click('[data-testid=topico-proximo]'); await o.waitForURL('**topico=premios');
assert.match(await o.locator('h1').innerText(), /Prêmios/);
await o.click('[data-testid=topico-voltar]'); await o.waitForURL('**/dashboard/configuracoes'); await o.waitForSelector('[data-testid=hub-progress]');
assert.match(await o.locator('[data-testid=hub-pontos]').innerText(), /R\$ 1 = 20 pontos/);
console.log('5. próximo assunto e voltar às Regras funcionam e o resumo já mostra o valor novo OK');

// 6. links antigos por etapa continuam abrindo o bloco certo
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=campanhas#campanhas'); await o.waitForSelector('#campanhas[open]');
await o.goto(BASE + '/dashboard/configuracoes?etapa=negocio'); await o.waitForSelector('[data-testid=etapa-negocio]');
assert.ok(await o.locator('[data-testid=regras-todas]').count());
console.log('6. links antigos por etapa seguem funcionando, com o atalho para todas as regras OK');

await b.close();
console.log('ALL OK (Regras como central)');
