// Caixa: o histórico de lançamentos tem busca (nome, CPF ou valor), datas, situação e páginas, para ir além dos últimos.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"pointsPerReal"=10`);
sql(`delete from "Customer" where email='marina@teste.com'`);
sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash","termsAcceptedAt","termsVersion") select gen_random_uuid()::text,'00000000191',phone,'Marina',email_new,"passwordHash","termsAcceptedAt","termsVersion" from "Customer", (select 'marina@teste.com' as email_new) x where email='lucas@teste.com'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const marina = sql(`select id from "Customer" where email='marina@teste.com'`);
sql(`delete from "Wallet" where "restaurantId"='${rid}'; delete from "Claim" where "restaurantId"='${rid}'`);
const claim = (desc, points, when, customer, redeemed, expires) =>
  `insert into "Claim"(id,token,"restaurantId","amountCents",points,description,"createdAt","expiresAt","redeemedAt","customerId") values (gen_random_uuid()::text,gen_random_uuid()::text,'${rid}',${points * 10},${points},'${desc}',${when},${expires ?? `${when} + interval '1 hour'`},${redeemed ? when : 'null'},${customer ? `'${customer}'` : 'null'})`;
for (let i = 1; i <= 18; i++) sql(claim(`Compra de R$ ${10 + i},00`, 100 + i, `now() - interval '${i} minutes'`, lucas, true));
for (let i = 1; i <= 3; i++) sql(claim('Compra de R$ 99,00', 990, `now() - interval '${i} days'`, marina, true));
sql(claim('Compra de R$ 77,00', 770, `now() - interval '40 days'`, lucas, true));
sql(claim('Compra de R$ 55,00 aguardando', 550, `now() - interval '2 minutes'`, null, false, `now() + interval '30 minutes'`));
sql(claim('Compra de R$ 66,00 expirado', 660, `now() - interval '3 hours'`, null, false, `now() - interval '1 hour'`));
// 18 + 3 + 1 + 1 + 1 = 24 lançamentos

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
const rows = () => o.locator('[data-testid=lancamentos-lista] li');
const resumo = () => o.locator('[data-testid=lancamentos-resumo]').innerText();
const open = async (q = '') => { await o.goto(`${BASE}/dashboard/caixa${q}`); await o.waitForSelector('[data-testid=lancamentos-resumo]'); };

// 1. sem filtro: 15 por página e páginas para ver o resto (não para nos 8 últimos)
await open();
assert.equal(await rows().count(), 15); assert.match(await resumo(), /24 lançamentos/);
await o.click('nav[aria-label="Páginas dos lançamentos"] >> text=Próximos'); await o.waitForURL('**pg=2**');
assert.equal(await rows().count(), 9);
assert.ok(await o.locator('text=Compra de R$ 77,00').count(), 'o lançamento mais antigo aparece na última página');
console.log('1. histórico completo em páginas de 15 (24 lançamentos) OK');

// 2. buscar por nome
await open(); await o.fill('#lq', 'marina'); await o.click('form[aria-label="Buscar lançamentos"] button:has-text("Buscar")'); await o.waitForURL('**q=marina**');
await o.waitForSelector('[data-testid=lancamentos-resumo]');
assert.equal(await rows().count(), 3); assert.match(await resumo(), /3 lançamentos/);
assert.ok(!(await o.locator('[data-testid=lancamentos-lista]').innerText()).includes('Lucas'));
console.log('2. busca por nome do cliente OK');

// 3. buscar por CPF (com máscara) e ver o CPF parcial na linha
await open(); await o.fill('#lq', '000.000.191'); await o.click('form[aria-label="Buscar lançamentos"] button:has-text("Buscar")'); await o.waitForURL('**q=*');
await o.waitForSelector('[data-testid=lancamentos-resumo]');
assert.equal(await rows().count(), 3); assert.match(await o.locator('[data-testid=lancamentos-lista]').innerText(), /Creditado a Marina \(CPF \*\*\*\.000\.001-\*\*\)/);
console.log('3. busca por CPF e CPF parcial na linha OK');

// 4. buscar pelo valor da compra
await open('?q=77%2C00'); assert.equal(await rows().count(), 1); assert.match(await o.locator('[data-testid=lancamentos-lista]').innerText(), /R\$ 77,00/);
console.log('4. busca pelo valor da compra OK');

// 5. datas: só o lançamento de 40 dias atrás
const day = (n) => new Date(Date.now() - 3 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
await open(`?de=${day(41)}&ate=${day(39)}`); assert.equal(await rows().count(), 1); assert.match(await resumo(), /1 lançamento/);
await open(`?de=${day(1)}`); assert.ok((await rows().count()) >= 15, 'a partir de ontem entram os recentes');
assert.ok(!(await o.locator('[data-testid=lancamentos-lista]').innerText()).includes('R$ 77,00'));
console.log('5. filtro por datas OK');

// 6. situação: creditados, aguardando e expirados
await open('?sit=aguardando'); assert.equal(await rows().count(), 1); assert.match(await o.locator('[data-testid=lancamentos-lista]').innerText(), /Aguardando leitura/);
await open('?sit=expirados'); assert.equal(await rows().count(), 1); assert.match(await o.locator('[data-testid=lancamentos-lista]').innerText(), /Expirado/);
await open('?sit=creditados'); assert.match(await resumo(), /22 lançamentos/);
console.log('6. filtro por situação OK');

// 7. nada encontrado e limpar filtros
await open('?q=zzzz'); assert.equal(await rows().count(), 0); assert.ok(await o.locator('text=Nenhum lançamento encontrado').count());
await o.click('a:has-text("Limpar filtros")'); await o.waitForSelector('[data-testid=lancamentos-lista]'); assert.equal(await rows().count(), 15);
console.log('7. sem resultado e limpar filtros OK');

// 8. sem rolagem lateral no celular
assert.ok((await o.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)), 'sem rolagem lateral');
console.log('8. celular sem rolagem lateral OK');

// 9. chips de situação (um toque, sem caixa de seleção) e datas lado a lado, sem sobrepor nem sair da tela
await open(); await o.click('[aria-label="Situação do lançamento"] >> text=Expirados'); await o.waitForURL('**sit=expirados**');
await o.waitForSelector('[data-testid=lancamentos-resumo]'); assert.equal(await rows().count(), 1);
assert.equal(await o.locator('[aria-label="Situação do lançamento"] a[aria-current=true]').innerText(), 'Expirados');
await o.fill('#lq', 'compra'); await o.click('form[aria-label="Buscar lançamentos"] button:has-text("Buscar")'); await o.waitForURL('**q=compra**');
assert.match(o.url(), /sit=expirados/, 'buscar mantém a situação escolhida');
await open('?de=' + day(30));
const box = (sel) => o.locator(sel).evaluate((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right }; });
const [de, ate, vw] = [await box('#lde'), await box('#late'), await o.evaluate(() => innerWidth)];
assert.ok(de.r <= ate.l, `De e Até não se sobrepõem (${de.r} <= ${ate.l})`);
assert.ok(ate.r <= vw, `Até cabe na tela (${ate.r} <= ${vw})`);
console.log('9. situação em chips, busca mantém filtros e datas lado a lado OK');

await b.close();
console.log('ALL OK (caixa: busca nos lançamentos)');
