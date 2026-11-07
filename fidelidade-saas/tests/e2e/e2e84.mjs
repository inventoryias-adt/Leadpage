// Avaliação no Google em três telas + conferência automática (modo de teste: as avaliações vêm de um arquivo, não do Google).
// Tela 1 "Curtiu? Conta pra cidade" → tela 2 "Te esperando no Google" → tela 3 "Conferindo sua avaliação…".
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const MOCK = process.env.GOOGLE_REVIEWS_MOCK_FILE || '/tmp/google-mock.json';
const LOC = 'accounts/1/locations/9';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();

sql('truncate "RateLimit"; delete from "Notification"');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
const cname = sql(`select name from "Customer" where id='${cid}'`);
const parts = cname.trim().split(/\s+/);
const author = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]; // como o Google mostra: "Lucas B."
sql(`update "Restaurant" set "guideDoneAt"=now() where id='${rid}'; update "Unit" set "googleReviewUrl"='https://g.page/r/CdemoBurgerDoZe/review', "googleLocation"=null where "restaurantId"='${rid}'`);
sql(`delete from "GoogleConnection" where "restaurantId"='${rid}'; delete from "GoogleReviewIntent"; delete from "InteractionClaim"; delete from "InteractionRule" where "restaurantId"='${rid}'; delete from "Wallet" where "customerId"='${cid}'`);
sql(`insert into "InteractionRule" (id,"restaurantId",label,points,approval) values ('r-google','${rid}','Avaliação 5 estrelas no Google',100,'MANUAL')`);
const mock = (rows) => writeFileSync(MOCK, JSON.stringify({ [LOC]: rows }));
mock([]);
const balance = () => Number(sql(`select coalesce(sum(balance),0) from "Wallet" where "customerId"='${cid}' and "restaurantId"='${rid}'`));
const claim = () => sql(`select status||'|'||coalesce("decidedBy",'')||'|'||("openedAt" is not null)::text||'|'||coalesce("googleReviewId",'') from "InteractionClaim" where "ruleId"='r-google' order by "createdAt" desc limit 1`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
await ctx.route('**/g.page/**', (r) => r.fulfill({ contentType: 'text/html', body: 'ok' })); // o Google de verdade não é aberto nos testes
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
let nav = 0;
const lugar = async () => { await c.goto(`${BASE}/lugar/${rid}?v=${++nav}#acoes`); await c.waitForSelector('[data-testid=gr-trigger]'); };
const step = (n) => c.locator(`[data-testid=gr-step-${n}]`);

// 1. as três telas, sem o Google ligado: o lugar confere
await lugar();
assert.ok(!(await c.locator('#acoes').innerText()).includes('5 estrelas'), 'o texto antigo "5 estrelas" não aparece');
await c.locator('[data-testid=gr-trigger]').click();
await step('prompt').waitFor();
const t1 = await step('prompt').innerText();
assert.match(t1, /Curtiu\? Conta pra cidade/); assert.match(t1, /\+100 pts/);
await c.locator('[data-testid=gr-later]').click();
assert.equal(await c.locator('[data-testid=gr-dialog]').isVisible(), false, '"Agora não" fecha');
await c.locator('[data-testid=gr-trigger]').click();
await c.locator('[data-testid=gr-open]').click();
await step('waiting').waitFor();
assert.match(await step('waiting').innerText(), /Te esperando no Google/);
for (let i = 0; i < 20 && sql(`select count(*) from "GoogleReviewIntent" where "customerId"='${cid}'`) !== '1'; i++) await c.waitForTimeout(250); // o aviso ao servidor vai em segundo plano
assert.equal(sql(`select count(*) from "GoogleReviewIntent" where "customerId"='${cid}'`), '1', 'guardou a hora em que abriu o Google');
await c.locator('[data-testid=gr-done]').click();
await step('checking').waitFor();
const t3 = await step('checking').innerText();
assert.match(t3, /Conferindo sua avaliação/); assert.match(t3, /O lugar vai conferir/);
assert.equal(await c.locator('[data-testid=gr-recheck]').count(), 0, 'sem conferência automática não há "Conferir de novo"');
assert.equal(claim(), 'PENDING||true|', 'pedido pendente, com a hora de abertura');
assert.equal(sql(`select count(*) from "GoogleReviewIntent" where "customerId"='${cid}'`), '0', 'a marca de abertura foi usada');
assert.equal(balance(), 0);
console.log('1. três telas (Curtiu? → Te esperando no Google → Conferindo) sem Google ligado: pedido pendente OK');

// 2. o dono liga o Google e escolhe o perfil da unidade
await o.goto(BASE + '/api/google/connect'); await o.waitForURL('**google=ok**');
await o.waitForSelector('[data-testid=google-connected]');
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' and active order by "createdAt" limit 1`);
await o.selectOption(`[data-testid=google-loc-${unit}]`, LOC);
await o.locator(`[data-testid=google-save-${unit}]`).click();
for (let i = 0; i < 40 && sql(`select "googleLocation" from "Unit" where id='${unit}'`) !== LOC; i++) await o.waitForTimeout(250);
assert.equal(sql(`select "googleLocation" from "Unit" where id='${unit}'`), LOC);
assert.equal(sql(`select ("refreshTokenEnc" like 'v1.%')::text from "GoogleConnection" where "restaurantId"='${rid}'`), 'true', 'o token é guardado cifrado');
console.log('2. dono liga o Google e escolhe o perfil da unidade OK');

// 3. avaliação antiga (antes de abrir o Google) não confirma
sql(`delete from "InteractionClaim"; delete from "Wallet" where "customerId"='${cid}'`);
mock([{ id: 'rev-velha', author, rating: 5, comment: 'Ótimo', createdAt: new Date(Date.now() - 86_400_000).toISOString() }]);
await lugar();
await c.locator('[data-testid=gr-trigger]').click(); await c.locator('[data-testid=gr-open]').click(); await c.waitForTimeout(800); await c.locator('[data-testid=gr-done]').click();
await step('checking').waitFor();
assert.match(await step('checking').innerText(), /procurando a sua avaliação/);
sql(`update "InteractionClaim" set "checkedAt"=null`);
await c.locator('[data-testid=gr-recheck]').click();
await c.waitForTimeout(1500);
assert.equal((await step('checking').count()), 1, 'avaliação de ontem não confirma');
assert.equal(claim(), 'PENDING||true|');
console.log('3. avaliação antiga ou de outra pessoa não confirma; a tela segue "Conferindo" OK');

// 4. avaliação nova com o nome do cliente: confirma sozinho (+100)
mock([
  { id: 'rev-velha', author, rating: 5, createdAt: new Date(Date.now() - 86_400_000).toISOString() },
  { id: 'rev-outra', author: 'Pessoa Qualquer', rating: 5, createdAt: new Date().toISOString() },
  { id: 'rev-nova', author, rating: 4, comment: 'Gostei bastante', createdAt: new Date().toISOString() },
]);
sql(`update "InteractionClaim" set "checkedAt"=null`);
await c.locator('[data-testid=gr-recheck]').click();
await step('approved').waitFor();
assert.match(await step('approved').innerText(), /Avaliação confirmada!/); assert.match(await step('approved').innerText(), /\+100 pts/);
assert.equal(claim(), 'APPROVED|GOOGLE|true|rev-nova');
assert.equal(balance(), 100);
await c.locator('[data-testid=gr-close]').click();
await c.waitForSelector('text=Pontos recebidos');
assert.equal(await c.locator('[data-testid=gr-trigger]').count(), 0, 'depois de confirmada não pede de novo');
console.log('4. avaliação nova com o nome do cliente: confirmada sozinha, +100 pts, sem repetir OK');

// 5. a mesma avaliação não confirma um segundo pedido (cada avaliação vale uma vez)
sql(`update "InteractionClaim" set "createdAt"=now()-interval '40 days'`);
await lugar();
await c.locator('[data-testid=gr-trigger]').click(); await c.locator('[data-testid=gr-open]').click(); await c.waitForTimeout(800); await c.locator('[data-testid=gr-done]').click();
await step('checking').waitFor();
mock([{ id: 'rev-nova', author, rating: 5, createdAt: new Date().toISOString() }]);
sql(`update "InteractionClaim" set "checkedAt"=null where status='PENDING'`);
await c.locator('[data-testid=gr-recheck]').click(); await c.waitForTimeout(1500);
assert.equal(await step('checking').count(), 1, 'a mesma avaliação não confirma de novo');
assert.equal(balance(), 100);
console.log('5. a mesma avaliação não vale duas vezes OK');

// 6. o cron também confere (cliente fechou a tela): avaliação nova → pontos entram
mock([{ id: 'rev-cron', author, rating: 5, createdAt: new Date().toISOString() }]);
sql(`update "InteractionClaim" set "checkedAt"=null where status='PENDING'`);
const r = await fetch(`${BASE}/api/cron/lembretes`, { method: 'POST', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
const j = await r.json();
assert.equal(j.googleApproved, 1, `o cron confirma o pedido (${JSON.stringify(j)})`);
assert.equal(balance(), 200);
assert.equal(sql(`select "googleReviewId" from "InteractionClaim" where status='APPROVED' order by "decidedAt" desc limit 1`), 'rev-cron');
console.log('6. cron confirma o pedido sem o cliente na tela OK');

// 7. celular: sem rolagem lateral com a tela aberta
sql(`update "InteractionClaim" set "createdAt"=now()-interval '40 days'`);
await lugar(); await c.locator('[data-testid=gr-trigger]').click(); await step('prompt').waitFor();
assert.equal(await c.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'sem rolagem lateral');
const box = await c.locator('[data-testid=gr-dialog]').boundingBox();
assert.ok(box && box.width <= 390 && box.y > 100, `a folha fica embaixo e cabe na tela (${JSON.stringify(box)})`);
console.log('7. celular: folha embaixo, sem rolagem lateral OK');

// 8. o dono desliga o Google: some a conexão e as unidades voltam a ser conferidas à mão
await o.goto(BASE + '/dashboard/configuracoes?etapa=negocio'); await o.waitForSelector('[data-testid=google-disconnect]');
await o.locator('[data-testid=google-disconnect]').click(); await o.waitForSelector('[data-testid=google-connect]');
assert.equal(sql(`select count(*) from "GoogleConnection" where "restaurantId"='${rid}'`), '0');
assert.equal(sql(`select count(*) from "Unit" where "restaurantId"='${rid}' and "googleLocation" is not null`), '0');
console.log('8. dono desliga o Google OK');

await b.close();
console.log('ALL OK (avaliação no Google em três telas e conferência automática)');
