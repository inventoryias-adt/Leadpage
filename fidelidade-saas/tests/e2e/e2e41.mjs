// Interações que dão pontos são editáveis: muda a descrição e os pontos sem apagar (mesmo registro, o cliente vê o novo valor).
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const wait = (p, t) => p.waitForTimeout(t);
const until = async (page, fn, what, tries = 60) => {
  for (let i = 0; i < tries; i++) { if (fn()) return; await wait(page, 500); }
  throw new Error('Tempo esgotado: ' + what);
};
sql('truncate "RateLimit"');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`update "Restaurant" set listed=true, "onboardedAt"=coalesce("onboardedAt",now()) where id='${rid}'`);
sql(`delete from "InteractionRule" where "restaurantId"='${rid}' and label like 'Teste editar%'`);
const id = sql(`insert into "InteractionRule"(id,"restaurantId",label,points,active) values (gen_random_uuid(),'${rid}','Teste editar: foto no Instagram',50,true) returning id`).split('\n')[0];
const total = () => sql(`select count(*) from "InteractionRule" where "restaurantId"='${rid}'`);
const before = total();

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const init = () => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); };
const octx = await b.newContext({ viewport: { width: 1100, height: 1000 } }); await octx.addInitScript(init);
const o = await octx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1');
await o.click('button[type=submit]'); await o.waitForURL('**/dashboard**');

await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo');
const row = o.locator('[data-testid=interaction-row]:has-text("Teste editar: foto no Instagram")');
await row.waitFor();
assert.equal(await row.locator('input[name=label]').count(), 0); // fechado até tocar em Editar
await row.locator('button[aria-label^="Editar"]').click();
assert.equal(await row.locator('input[name=label]').inputValue(), 'Teste editar: foto no Instagram'); // já vem preenchido
assert.equal(await row.locator('input[name=points]').inputValue(), '50');
console.log('1. "Editar" abre o formulário já preenchido com a descrição e os pontos atuais OK');

await row.locator('input[name=label]').fill('Teste editar: story no Instagram marcando o lugar');
await row.locator('input[name=points]').fill('120');
await row.locator('button[type=submit]').click();
await until(o, () => sql(`select label||'/'||points from "InteractionRule" where id='${id}'`) === 'Teste editar: story no Instagram marcando o lugar/120', 'salvou');
assert.equal(total(), before); // editou o mesmo registro: não criou outro nem apagou
assert.equal(sql(`select active from "InteractionRule" where id='${id}'`), 't');
await o.waitForSelector('[data-testid=interaction-row]:has-text("story no Instagram marcando o lugar")');
assert.match(await o.locator('[data-testid=interaction-row]:has-text("story no Instagram")').first().innerText(), /\+120/);
console.log('2. salvar muda descrição e pontos no mesmo registro (sem apagar e criar de novo) OK');

// o cliente vê o valor novo na página do lugar
const cctx = await b.newContext({ viewport: { width: 420, height: 900 } }); await cctx.addInitScript(init);
const c = await cctx.newPage();
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1');
await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await c.goto(BASE + '/lugar/' + rid); await c.waitForSelector('text=story no Instagram marcando o lugar');
assert.match(await c.locator('body').innerText(), /\+120/);
console.log('3. o cliente já vê a descrição e os pontos novos na página do lugar OK');

// descrição vazia não passa (o campo exige)
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo');
const row2 = o.locator('[data-testid=interaction-row]:has-text("story no Instagram marcando o lugar")');
// a página acabou de carregar: se o clique vier antes de a tela hidratar o formulário não abre, então repete até o campo aparecer
const labelInput = row2.locator('input[name=label]');
for (let i = 0; i < 10 && !(await labelInput.isVisible()); i++) { await row2.locator('button[aria-label^="Editar"]').click().catch(() => {}); await wait(o, 600); }
await labelInput.fill('');
await row2.locator('button[type=submit]').click(); await wait(o, 700);
assert.equal(sql(`select label from "InteractionRule" where id='${id}'`), 'Teste editar: story no Instagram marcando o lugar');
console.log('4. descrição vazia não é aceita OK');

// cancelar fecha sem salvar
await row2.locator('input[name=label]').fill('Mudou mas cancelou');
await row2.locator('button:has-text("Cancelar")').click();
assert.equal(await row2.locator('input[name=label]').count(), 0);
assert.equal(sql(`select label from "InteractionRule" where id='${id}'`), 'Teste editar: story no Instagram marcando o lugar');
console.log('5. cancelar fecha o formulário sem salvar OK');

sql(`delete from "InteractionRule" where id='${id}'`);
await b.close();
console.log('ALL OK (editar interações que dão pontos)');
