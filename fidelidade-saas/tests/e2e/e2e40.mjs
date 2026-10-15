// Ofertas com prazo e estoque (cartão em Lugares, "restam N", preço volta ao normal), selo "% de volta", ícones,
// e aniversário do cliente com presente de pontos (cron, uma vez por ano).
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const SECRET = 'segredo-de-teste-1234567890';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const wait = (p, t) => p.waitForTimeout(t);
const nb = (s) => s.replace(/ /g, ' ');
const until = async (page, fn, what, tries = 60) => {
  for (let i = 0; i < tries; i++) { const v = fn(); if (v) return v; await wait(page, 500); }
  throw new Error('Tempo esgotado: ' + what);
};

sql('truncate "RateLimit"');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`update "Restaurant" set "ordersEnabled"=true, "orderPrepMin"=15, "birthdayPoints"=0, listed=true, "onboardedAt"=coalesce("onboardedAt",now()) where id='${rid}'`);
sql(`update "Unit" set active=true where "restaurantId"='${rid}'`);
sql(`delete from "Order" where "restaurantId"='${rid}'; delete from "MenuItem" where "restaurantId"='${rid}'; delete from "BirthdayGift" where "customerId"='${cid}'`);
sql(`update "Customer" set "birthDay"=null, "birthMonth"=null where id='${cid}'`);
if (!sql(`select count(*) from "Reward" where "restaurantId"='${rid}' and active`) || sql(`select count(*) from "Reward" where "restaurantId"='${rid}' and active`) === '0') {
  sql(`insert into "Reward"(id,"restaurantId",name,"pointsCost",active) values (gen_random_uuid(),'${rid}','Brinde Teste',500,true)`);
}
const walletRow = sql(`select balance from "Wallet" where "customerId"='${cid}' and "restaurantId"='${rid}'`);
const balanceBefore = walletRow === '' ? null : Number(walletRow);
if (balanceBefore == null) sql(`insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid(),'${cid}','${rid}',0)`);
const bal = () => Number(sql(`select balance from "Wallet" where "customerId"='${cid}' and "restaurantId"='${rid}'`));
const bal0 = bal();
const stock = () => sql(`select "offerStock" from "MenuItem" where name='Açaí Oferta' and "restaurantId"='${rid}'`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const init = () => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); };

// ---- dono
const octx = await b.newContext({ viewport: { width: 1100, height: 1100 } }); await octx.addInitScript(init);
const o = await octx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR dono', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1');
await o.click('button[type=submit]'); await o.waitForURL('**/dashboard**');

const F = 'form:has(#m-name-novo)';
const fillItem = async ({ name, price, promo = '', ends = '', stockN = '', spotlight = false }) => {
  await o.goto(BASE + '/dashboard/cardapio'); await o.waitForSelector('#m-name-novo');
  await o.fill('#m-name-novo', name); await o.fill('#m-price-novo', price); await o.fill('#m-promo-novo', promo);
  if (ends) await o.fill('#m-ends-novo', ends);
  if (stockN) await o.fill('#m-stock-novo', stockN);
  if (spotlight) await o.check(`${F} input[name=spotlight]`);
  await o.click(`${F} button[type=submit]`);
};
await fillItem({ name: 'Sem promo', price: '10,00', spotlight: true });
await o.waitForSelector('text=Para fazer uma oferta, informe o preço promocional.');
await fillItem({ name: 'Prazo velho', price: '10,00', promo: '5,00', ends: '2020-01-01T10:00' });
await o.waitForSelector('text=O fim da oferta precisa ser uma data futura.');
await fillItem({ name: 'Estoque zero', price: '10,00', promo: '5,00', stockN: '0' });
await wait(o, 600);
assert.equal(await o.evaluate(() => document.querySelector('#m-stock-novo').validity.valid), false); // o próprio campo barra estoque menor que 1
assert.equal(sql(`select count(*) from "MenuItem" where "restaurantId"='${rid}'`), '0');
console.log('1. oferta sem promoção, com prazo vencido ou estoque inválido é recusada OK');

await fillItem({ name: 'Açaí Oferta', price: '28,00', promo: '15,90', ends: '2099-12-31T23:59', stockN: '5', spotlight: true });
await until(o, () => sql(`select count(*) from "MenuItem" where "restaurantId"='${rid}'`) === '1', 'item salvo');
assert.equal(sql(`select spotlight||'/'||"offerStock"||'/'||"offerStockTotal"||'/'||("offerEndsAt" is not null) from "MenuItem" where name='Açaí Oferta' and "restaurantId"='${rid}'`), 'true/5/5/true');
await o.goto(BASE + '/dashboard/cardapio'); await o.waitForSelector('text=restam 5'); await o.waitForSelector('text=até 31 dez · 23h59');
console.log('2. dono cria a oferta (até 31 dez · 23h59, 5 unidades, em destaque) OK');
const itemId = sql(`select id from "MenuItem" where name='Açaí Oferta' and "restaurantId"='${rid}'`);

// ---- cliente
const cctx = await b.newContext({ viewport: { width: 420, height: 1000 } }); await cctx.addInitScript(init);
const c = await cctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR cliente', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1');
await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');

await c.goto(BASE + '/lugares'); await c.waitForSelector('[data-testid=offer-card]');
const card = nb(await c.locator('[data-testid=offer-card]').innerText());
assert.match(card, /Açaí Oferta/); assert.match(card, /R\$ 15,90/); assert.match(card, /R\$ 28,00/); assert.match(card, /até 31 dez · 23h59/); assert.match(card, /restam 5/);
const ppr = Number(sql(`select "pointsPerReal" from "Restaurant" where id='${rid}'`)); const off = Number(sql(`select "pointsPerRealOff" from "Restaurant" where id='${rid}'`));
const pct = String(Math.round((ppr / off) * 1000) / 10).replace('.', ',');
const row = c.locator(`a[href^="/lugar/${rid}"]`).first();
assert.match(await row.innerText(), new RegExp(pct.replace(',', ',') + '% de volta'));
assert.ok(await row.locator('[data-testid=offers-icons] li').count() >= 1);
console.log(`3. Lugares mostra o cartão da oferta (restam 5, prazo, preço riscado), "${pct}% de volta" e os ícones OK`);

await c.click('[data-testid=offer-order]'); await c.waitForURL(`**/pedido?item=${itemId}**`);
await c.waitForSelector('[data-testid=bag-total]');
assert.match(nb(await c.locator('[data-testid=bag-total]').innerText()), /R\$ 15,90/); // "Pedir" já põe 1 na sacola
for (let i = 0; i < 4; i++) await c.click('button[aria-label="Adicionar mais um Açaí Oferta"]');
assert.equal(await c.locator('button[aria-label="Adicionar mais um Açaí Oferta"]').isDisabled(), true); // não passa do estoque
assert.match(nb(await c.locator('[data-testid=bag-total]').innerText()), /R\$ 79,50/);
await c.click('[data-testid=open-bag]'); await c.click('[data-testid=bag-continue]'); await c.click('[data-testid=order-confirm]');
await c.waitForSelector('[data-testid=order-done]');
assert.equal(stock(), '0');
const code = (await c.locator('[data-testid=order-code]').innerText()).trim();
console.log('4. "Pedir" já põe 1 na sacola; o limite é o estoque e comprar tudo zera a oferta OK');

await c.goto(BASE + '/lugar/' + rid + '/pedido'); await c.waitForSelector('[data-testid=menu-item]');
const afterTxt = nb(await c.locator('body').innerText());
assert.match(afterTxt, /R\$ 28,00/); assert.doesNotMatch(afterTxt, /R\$ 15,90/); assert.doesNotMatch(afterTxt, /restam/);
await c.goto(BASE + '/lugares'); await c.waitForSelector('text=Lugares por perto, text=Todos os lugares').catch(() => {});
await c.waitForSelector('a[href^="/lugar/"]'); await wait(c, 800);
assert.equal(await c.locator('[data-testid=offer-card]').count(), 0);
console.log('5. sem estoque, o preço volta ao normal e o cartão some de Lugares OK');

await c.goto(BASE + '/perfil/pedidos');
await c.locator(`[data-testid=my-order]:has-text("${code}") button:has-text("Cancelar pedido")`).click();
await until(c, () => stock() === '5', 'estoque devolvido');
await c.goto(BASE + '/lugares'); await c.waitForSelector('[data-testid=offer-card]');
console.log('6. cancelar o pedido devolve as 5 unidades e a oferta volta OK');

// estoque muda enquanto o cliente monta a sacola: o servidor recusa e não vende além
await c.goto(BASE + '/lugar/' + rid + '/pedido'); await c.waitForSelector('[data-testid=menu-item], [data-testid=menu-featured]');
for (let i = 0; i < 3; i++) await c.click('button[aria-label^="Adicionar Açaí Oferta"], button[aria-label="Adicionar mais um Açaí Oferta"]');
sql(`update "MenuItem" set "offerStock"=1 where id='${itemId}'`);
await c.click('[data-testid=open-bag]'); await c.click('[data-testid=bag-continue]'); await c.click('[data-testid=order-confirm]');
await c.waitForSelector('text=restam só 1');
assert.equal(sql(`select count(*) from "Order" where "restaurantId"='${rid}' and status='RECEIVED'`), '0');
assert.equal(stock(), '1');
console.log('7. estoque que mudou no meio do caminho: o servidor recusa (restam só 1) e não vende além OK');

// prazo vencido: preço normal e nada em Lugares
sql(`update "MenuItem" set "offerStock"=5, "offerEndsAt"=now()-interval '1 hour' where id='${itemId}'`);
await c.evaluate(() => sessionStorage.clear());
await c.goto(BASE + '/lugar/' + rid + '/pedido'); await c.waitForSelector('[data-testid=menu-item]');
assert.doesNotMatch(nb(await c.locator('body').innerText()), /R\$ 15,90/);
await c.goto(BASE + '/lugares'); await c.waitForSelector('a[href^="/lugar/"]'); await wait(c, 800);
assert.equal(await c.locator('[data-testid=offer-card]').count(), 0);
console.log('8. passou do prazo: volta ao preço normal e sai de Lugares OK');

// ---- aniversário
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('#e-bd');
await o.fill('#e-bd', '50'); await o.click('form:has(#e-bd) button[type=submit]');
await until(o, () => sql(`select "birthdayPoints" from "Restaurant" where id='${rid}'`) === '50', 'presente salvo');
await c.goto(BASE + '/lugar/' + rid); await c.waitForSelector('[data-testid=birthday-card]');
assert.match(await c.locator('[data-testid=birthday-card]').innerText(), /Informar aniversário/);
assert.match(await c.locator('[data-testid=birthday-card]').innerText(), /ganhe 50 pontos de presente/);
const today = sql(`select extract(day from now() at time zone 'America/Sao_Paulo')::int||'/'||extract(month from now() at time zone 'America/Sao_Paulo')::int`).split('/');
await c.click('[data-testid=birthday-open]'); await c.selectOption('#b-day', today[0]); await c.selectOption('#b-month', today[1]);
await c.click('form:has(#b-day) button[type=submit]');
await until(c, () => sql(`select "birthDay"||'/'||"birthMonth" from "Customer" where id='${cid}'`) === today.join('/'), 'aniversário salvo');
await c.goto(BASE + '/lugar/' + rid); await c.waitForSelector('text=Saldo, text=seu saldo').catch(() => {});
await wait(c, 800);
assert.equal(await c.locator('[data-testid=birthday-card]').count(), 0); // já informado: some da página do lugar
await c.goto(BASE + '/perfil'); await c.waitForSelector('[data-testid=birthday-card]');
assert.match(await c.locator('[data-testid=birthday-card]').innerText(), /Seu aniversário:/);
console.log('9. cliente informa o aniversário (dia e mês) e vê no Perfil; o convite some do lugar OK');

const call = () => fetch(BASE + '/api/cron/lembretes', { method: 'POST', headers: { authorization: 'Bearer ' + SECRET } }).then((r) => r.json());
const r1 = await call();
assert.ok(r1.birthdayGifts >= 1, JSON.stringify(r1));
assert.equal(bal() - bal0, 50);
assert.equal(sql(`select count(*) from "BirthdayGift" where "customerId"='${cid}' and "restaurantId"='${rid}'`), '1');
assert.equal(sql(`select count(*) from "Transaction" t join "Wallet" w on w.id=t."walletId" where w."customerId"='${cid}' and t.description='Presente de aniversário'`), '1');
const r2 = await call();
assert.equal(r2.birthdayGifts, 0); assert.equal(bal() - bal0, 50); // o cron roda de novo no mesmo dia: não repete
console.log('10. o cron dá 50 pontos no dia e não repete no mesmo ano OK');

sql(`delete from "BirthdayGift" where "customerId"='${cid}'`);
const tomorrow = sql(`select extract(day from (now() at time zone 'America/Sao_Paulo') + interval '1 day')::int||'/'||extract(month from (now() at time zone 'America/Sao_Paulo') + interval '1 day')::int`).split('/');
sql(`update "Customer" set "birthDay"=${tomorrow[0]}, "birthMonth"=${tomorrow[1]} where id='${cid}'`);
assert.equal((await call()).birthdayGifts, 0); assert.equal(bal() - bal0, 50);
console.log('11. aniversário em outro dia não ganha presente hoje OK');

await c.goto(BASE + '/perfil'); await c.waitForSelector('[data-testid=birthday-card]');
await c.click('[data-testid=birthday-open]'); await c.click('[data-testid=birthday-remove]');
await until(c, () => sql(`select "birthDay" is null and "birthMonth" is null from "Customer" where id='${cid}'`) === 't', 'aniversário removido');
console.log('12. cliente remove o aniversário quando quiser OK');

// limpeza
sql(`delete from "Transaction" where description='Presente de aniversário' and "walletId" in (select id from "Wallet" where "customerId"='${cid}')`);
sql(`delete from "BirthdayGift" where "customerId"='${cid}'`);
sql(`delete from "Order" where "restaurantId"='${rid}'; delete from "MenuItem" where "restaurantId"='${rid}'`);
sql(`update "Restaurant" set "birthdayPoints"=0, "ordersEnabled"=false where id='${rid}'`);
sql(`update "Wallet" set balance=${balanceBefore ?? 0} where "customerId"='${cid}' and "restaurantId"='${rid}'`);
await b.close();
console.log('ALL OK (ofertas, selo de volta, ícones e aniversário)');
