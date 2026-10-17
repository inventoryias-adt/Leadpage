import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const wait = (p, ms) => p.waitForTimeout(ms);
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(), listed=true, "checkInPoints"=10, "referralPoints"=50, "birthdayPoints"=50 where email='ze@burger.com'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`delete from "Challenge" where "restaurantId"='${rid}'; delete from "Promotion" where "restaurantId"='${rid}'`);
async function until(page, fn, msg) { for (let i = 0; i < 60; i++) { if (fn()) return; await wait(page, 250); } assert.fail(msg); }

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
const box = async (sel) => (await o.locator(sel).first().boundingBox());

// 1. Seu negócio: nome em meia largura com "Salvar nome" ao lado; "Salvar identidade" ao lado da chave de Lugares
await o.goto(BASE + '/dashboard/configuracoes?etapa=negocio'); await o.waitForSelector('#b-name');
{
  const form = await box('#dados form'); const input = await box('#b-name'); const btn = await box('#dados button:has-text("Salvar nome")');
  assert.ok(input.width < form.width * 0.6, `campo do nome em meia largura (${Math.round(input.width)} de ${Math.round(form.width)})`);
  assert.ok(Math.abs(btn.y - input.y) < input.height, 'botão Salvar nome na mesma linha do campo');
  const lug = await box('#identidade input[name=listed]'); const salvar = await box('#identidade button:has-text("Salvar identidade")');
  assert.ok(Math.abs(lug.y - salvar.y) < 60, 'Salvar identidade ao lado da chave de Lugares');
}
console.log('1. nome em meia largura com Salvar ao lado; Salvar identidade ao lado da chave de Lugares OK');

// 2. "Aparecer em Lugares" já vem ligado; desligar mostra o aviso, ligar de novo tira
assert.ok(await o.locator('#identidade input[name=listed]').isChecked(), 'ligado por padrão');
assert.equal(await o.locator('[data-testid=listed-off-warning]').count(), 0);
await o.locator('#identidade input[name=listed]').uncheck();
await o.waitForSelector('[data-testid=listed-off-warning]');
assert.match(await o.locator('[data-testid=listed-off-warning]').innerText(), /deixa de aparecer em “Lugares”/);
await o.locator('#identidade input[name=listed]').check();
assert.equal(await o.locator('[data-testid=listed-off-warning]').count(), 0);
console.log('2. Lugares ligado por padrão; desligar avisa e ligar de novo tira o aviso OK');

// 3. Ganhar pontos: campos estreitos com "Salvar regras" na mesma linha
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras'); await o.waitForSelector('#r-ppr');
{
  const form = await box('#pontos form'); const a = await box('#r-ppr'); const m = await box('#r-max'); const btn = await box('#pontos button:has-text("Salvar regras")');
  assert.ok(a.width < form.width * 0.45 && m.width < form.width * 0.45, 'campos de pontos e resgates estreitos');
  assert.ok(Math.abs(btn.y - a.y) < a.height + 10 && Math.abs(btn.y - m.y) < m.height + 10, 'Salvar regras na mesma linha');
  assert.ok(btn.width < 200, 'botão Salvar regras proporcional');
}
console.log('3. pontos por real e resgates/mês estreitos, com Salvar regras ao lado OK');

// 4. check-in, indicação e aniversário: 3 campos + Salvar numa linha, cada um com chave liga/desliga
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=engajamento'); await o.waitForSelector('#e-ci');
{
  const ci = await box('#e-ci'); const rf = await box('#e-rf'); const bd = await box('#e-bd'); const salvar = await box('#engajamento button:has-text("Salvar")');
  assert.ok(Math.abs(ci.y - rf.y) < 4 && Math.abs(rf.y - bd.y) < 4 && Math.abs(salvar.y - bd.y) < bd.height + 20, 'os três campos e o Salvar na mesma linha');
}
assert.equal(await o.locator('#engajamento [role=switch][aria-checked=true]').count(), 3);
// desliga o aniversário e salva: grava 0 e a chave continua desligada ao recarregar
await o.locator('#engajamento [role=switch][aria-label*="presente de aniversário"]').click();
assert.equal(await o.locator('#e-bd').isDisabled(), true);
await o.locator('#engajamento button:has-text("Salvar")').click();
await until(o, () => sql(`select "birthdayPoints" from "Restaurant" where id='${rid}'`) === '0', 'aniversário desligado');
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=engajamento'); await o.waitForSelector('#e-bd');
assert.equal(await o.locator('#e-bd').isDisabled(), true);
assert.match(await o.locator('#engajamento summary').innerText(), /2 ligados/);
// liga de novo: volta com um valor padrão e salva
await o.locator('#engajamento [role=switch][aria-label*="presente de aniversário"]').click();
assert.ok(Number(await o.inputValue('#e-bd')) > 0, 'ao ligar, volta com pontos');
await o.locator('#engajamento button:has-text("Salvar")').click();
await until(o, () => Number(sql(`select "birthdayPoints" from "Restaurant" where id='${rid}'`)) > 0, 'aniversário religado');
console.log('4. três campos + Salvar numa linha; chaves liga/desliga gravam 0 e voltam OK');

// 5. check-in desligado: some a distância máxima e grava 0 (a distância continua guardada)
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=engajamento'); await o.waitForSelector('#e-ci');
assert.equal(await o.locator('#e-rad').count(), 1);
await o.locator('#engajamento [role=switch][aria-label*="check-in"]').click();
assert.equal(await o.locator('#e-rad').count(), 0, 'sem check-in, sem distância máxima');
await o.locator('#engajamento button:has-text("Salvar")').click();
await until(o, () => sql(`select "checkInPoints" from "Restaurant" where id='${rid}'`) === '0', 'check-in desligado');
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=engajamento'); await o.waitForSelector('#e-ci');
assert.equal(await o.locator('#e-rad').count(), 0);
await o.locator('#engajamento [role=switch][aria-label*="check-in"]').click();
await o.waitForSelector('#e-rad');
await o.locator('#engajamento button:has-text("Salvar")').click();
await until(o, () => Number(sql(`select "checkInPoints" from "Restaurant" where id='${rid}'`)) > 0, 'check-in religado');
console.log('5. desligar o check-in esconde a distância máxima e grava 0; religar traz de volta OK');

// 6. o botão de editar interação é um lápis (não a engrenagem)
const iid = sql(`insert into "InteractionRule"(id,"restaurantId",label,points,active,approval) values (gen_random_uuid(),'${rid}','Teste lápis: avaliar no Google',30,true,'COUNTER') returning id`).split('\n')[0];
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=interacoes'); await o.waitForSelector('[data-testid=interaction-row]');
{
  const edit = o.locator('[data-testid=interaction-row]:has-text("Teste lápis") button[aria-label^="Editar"]');
  assert.equal(await edit.locator('svg circle').count(), 0, 'sem a engrenagem (que tem um círculo no meio)');
  assert.equal(await edit.locator('svg path').count(), 2, 'ícone de lápis');
}
sql(`delete from "InteractionRule" where id='${iid}'`);
console.log('6. editar interação usa lápis, não engrenagem OK');

// 7. desafios: editar, pausar e retomar
sql(`insert into "Challenge"(id,"restaurantId",title,kind,target,"minAmountCents",period,"bonusPoints",active) values (gen_random_uuid(),'${rid}','x','PURCHASES',2,4200,'WEEK',200,true)`);
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=desafios'); await o.waitForSelector('[data-testid=challenge-row]');
const crow = o.locator('[data-testid=challenge-row]').first();
assert.match(await crow.innerText(), /Ativo/);
await crow.locator('button[aria-label^="Editar desafio"]').click();
await crow.locator('input[name=bonusPoints]').fill('350');
await crow.locator('input[name=target]').fill('3');
await o.waitForSelector('[data-testid=client-preview]');
assert.match(await crow.locator('[data-testid=challenge-preview]').innerText(), /3 compras|3 vezes|\+350/);
await crow.locator('button:has-text("Salvar desafio")').click();
await until(o, () => sql(`select "bonusPoints"||'/'||target from "Challenge" where "restaurantId"='${rid}'`) === '350/3', 'desafio editado');
assert.equal(sql(`select count(*) from "Challenge" where "restaurantId"='${rid}'`), '1', 'editou o mesmo registro');
assert.match(sql(`select title from "Challenge" where "restaurantId"='${rid}'`), /3 vezes/);
await o.waitForSelector('[data-testid=challenge-row]:has-text("+350")');
// pausar: some para o cliente; retomar: volta
await o.locator('[data-testid=challenge-row] button:has-text("Pausar")').click();
await until(o, () => sql(`select active from "Challenge" where "restaurantId"='${rid}'`) === 'f', 'pausou');
await o.waitForSelector('[data-testid=challenge-row]:has-text("Pausado")');
const cctx = await b.newContext({ viewport: { width: 420, height: 900 } });
await cctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await cctx.newPage();
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await c.goto(BASE + '/lugar/' + rid); await c.waitForSelector('#desafios');
assert.equal(await c.locator('text=/compras .*semana|vezes na semana/').count(), 0, 'desafio pausado não aparece para o cliente');
await o.locator('[data-testid=challenge-row] button:has-text("Retomar")').click();
await until(o, () => sql(`select active from "Challenge" where "restaurantId"='${rid}'`) === 't', 'retomou');
await c.reload(); await c.waitForSelector('#desafios');
assert.ok(await c.locator('text=/\\+350 pts/').count(), 'desafio retomado volta para o cliente');
console.log('7. desafios: editar no mesmo registro, pausar some para o cliente e retomar volta OK');

// 8. campanhas: editar mesmo estando ativa, e mostrar onde aparece
const pid = sql(`insert into "Promotion"(id,"restaurantId",title,kind,multiplier,color) values (gen_random_uuid(),'${rid}','Terça em dobro','MULTIPLIER',2,'azul') returning id`).split('\n')[0];
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=campanhas'); await o.waitForSelector('[data-testid=promo-card]');
const pcard = o.locator('[data-testid=promo-card]').first();
assert.match(await pcard.innerText(), /Aparece no app: vitrine Lugares/);
assert.ok(await pcard.locator('button:has-text("Pausar")').count() && await pcard.locator('button:has-text("Editar")').count(), 'ativa: tem Pausar e Editar');
await pcard.locator('summary:has-text("Ver como o cliente vê")').click();
assert.match(await pcard.locator('[data-testid=client-preview]').innerText(), /Terça em dobro/);
await pcard.locator('button:has-text("Editar")').click();
await pcard.locator('input[name=title]').fill('Quarta em triplo');
await pcard.locator('select[name=multiplier]').selectOption('3');
await pcard.locator('button:has-text("Salvar campanha")').click();
await until(o, () => sql(`select title||'/'||multiplier from "Promotion" where id='${pid}'`) === 'Quarta em triplo/3', 'campanha editada');
assert.equal(sql(`select count(*) from "Promotion" where "restaurantId"='${rid}'`), '1');
assert.equal(sql(`select color from "Promotion" where id='${pid}'`), 'azul', 'a cor continua a mesma');
await o.waitForSelector('[data-testid=promo-card]:has-text("Quarta em triplo")');
sql(`delete from "Promotion" where id='${pid}'; delete from "Challenge" where "restaurantId"='${rid}'`);
console.log('8. campanhas: ativas também têm Editar; onde aparece e prévia do cliente; edita no mesmo registro OK');

await b.close();
console.log('ALL OK (regras mais compactas, chaves, editar desafios e campanhas)');
