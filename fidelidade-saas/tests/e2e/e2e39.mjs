// Pedidos com retirada: o dono monta o cardápio e liga os pedidos; o cliente pede; o dono leva o pedido até
// "Retirado e pago" e os pontos entram. Também: cancelar, limite de pedidos em aberto e pedidos desligados.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const wait = (p, t) => p.waitForTimeout(t);
const nb = (s) => s.replace(/ /g, ' '); // formatBRL usa espaço sem quebra
const until = async (page, fn, what, tries = 60) => {
  for (let i = 0; i < tries; i++) { const v = fn(); if (v) return v; await wait(page, 500); }
  throw new Error('Tempo esgotado: ' + what);
};

sql('truncate "RateLimit"');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`update "Restaurant" set "ordersEnabled"=false, "orderPrepMin"=15, listed=true, "onboardedAt"=coalesce("onboardedAt",now()) where id='${rid}'`);
sql(`update "Unit" set active=true where "restaurantId"='${rid}'`);
sql(`delete from "Order" where "restaurantId"='${rid}'`);
sql(`delete from "MenuItem" where "restaurantId"='${rid}'`);
const ppr = Number(sql(`select "pointsPerReal" from "Restaurant" where id='${rid}'`));
const walletBefore = sql(`select coalesce(balance,0) from "Wallet" where "customerId"='${cid}' and "restaurantId"='${rid}'`);
const balanceBefore = walletBefore === '' ? null : Number(walletBefore);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const init = () => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); };

// ---- dono (computador)
const octx = await b.newContext({ viewport: { width: 1100, height: 1000 } }); await octx.addInitScript(init);
const o = await octx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR dono', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1');
await o.click('button[type=submit]'); await o.waitForURL('**/dashboard**');

await o.goto(BASE + '/dashboard/cardapio'); await o.waitForSelector('input[name=ordersEnabled]');
await o.check('input[name=ordersEnabled]');
await o.click('form:has(input[name=ordersEnabled]) button[type=submit]');
await o.waitForSelector('text=Cadastre ao menos um produto no cardápio antes de ligar os pedidos.');
assert.equal(sql(`select "ordersEnabled" from "Restaurant" where id='${rid}'`), 'f');
console.log('1. sem produto no cardápio, não deixa ligar os pedidos OK');

const addItem = async ({ name, desc, price, promo, category, featured, photo }) => {
  const f = 'form:has(#m-name-novo)';
  await o.fill('#m-name-novo', name); await o.fill('#m-desc-novo', desc); await o.fill('#m-price-novo', price);
  await o.fill('#m-promo-novo', promo ?? ''); await o.fill('#m-cat-novo', category);
  if (featured) await o.check(`${f} input[name=featured]`);
  if (photo) { await o.setInputFiles(`${f} input[type=file]`, photo); await wait(o, 800); }
  const before = Number(sql(`select count(*) from "MenuItem" where "restaurantId"='${rid}'`));
  await o.click(`${f} button[type=submit]`);
  await until(o, () => Number(sql(`select count(*) from "MenuItem" where "restaurantId"='${rid}'`)) > before, 'produto salvo'); // o aviso da vez anterior ainda pode estar na tela
};
await addItem({ name: 'Açaí Teste 300 ml', desc: 'Açaí cremoso com ninho', price: '28,00', promo: '15,90', category: 'Clássicos', featured: true, photo: 'prato.png' });
await addItem({ name: 'Suco Teste', desc: 'Suco natural', price: '8,00', category: 'Bebidas' });
assert.equal(sql(`select count(*) from "MenuItem" where "restaurantId"='${rid}'`), '2');
assert.equal(sql(`select "priceCents"||'/'||"promoCents"||'/'||featured||'/'||("imageId" is not null) from "MenuItem" where name='Açaí Teste 300 ml' and "restaurantId"='${rid}'`), '2800/1590/true/true');
console.log('2. dono cadastra dois produtos (promoção, destaque e foto) OK');

// promoção inválida (maior que o preço) é recusada
await o.fill('#m-name-novo', 'Inválido'); await o.fill('#m-price-novo', '10,00'); await o.fill('#m-promo-novo', '12,00');
await o.click('form:has(#m-name-novo) button[type=submit]');
await o.waitForSelector('text=O preço promocional precisa ser menor que o preço normal.');
assert.equal(sql(`select count(*) from "MenuItem" where "restaurantId"='${rid}'`), '2');
console.log('3. promoção maior que o preço é recusada OK');
await o.reload(); await o.waitForSelector('input[name=ordersEnabled]');

await o.check('input[name=ordersEnabled]'); await o.selectOption('#o-prep', '20');
await o.click('form:has(input[name=ordersEnabled]) button[type=submit]');
await o.waitForSelector('text=Pedidos ligados.');
assert.equal(sql(`select "ordersEnabled"||'/'||"orderPrepMin" from "Restaurant" where id='${rid}'`), 'true/20');
console.log('4. dono liga os pedidos com preparo de 20 min OK');

// ---- cliente (celular)
const cctx = await b.newContext({ viewport: { width: 420, height: 900 } }); await cctx.addInitScript(init);
const c = await cctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR cliente', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1');
await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');

await c.goto(BASE + '/lugar/' + rid);
await c.click('[data-testid=make-order]'); await c.waitForURL('**/pedido**');
await c.waitForSelector('[data-testid=menu-featured]');
assert.match(await c.locator('[data-testid=menu-featured]').innerText(), /Açaí Teste 300 ml/);
assert.match(nb(await c.locator('[data-testid=menu-featured]').innerText()), /R\$ 15,90/);
assert.match(nb(await c.locator('[data-testid=menu-featured]').innerText()), /R\$ 28,00/); // preço cheio riscado
assert.equal(await c.locator('[data-testid=menu-item]').count(), 1); // o destaque não repete na lista
assert.match(await c.locator('body').innerText(), /retirada grátis/);
console.log('5. cliente vê o cardápio: destaque com preço riscado e a lista por categoria OK');

await c.click('button[aria-label="Adicionar Açaí Teste 300 ml à sacola"]');
await c.click('button[aria-label="Adicionar mais um Açaí Teste 300 ml"]');
await c.click('button[aria-label="Adicionar Suco Teste à sacola"]');
assert.match(nb(await c.locator('[data-testid=bag-total]').innerText()), /R\$ 39,80/);
await c.click('[data-testid=open-bag]'); await c.waitForSelector('[data-testid=bag-line]');
assert.equal(await c.locator('[data-testid=bag-line]').count(), 2);
const expectPoints = Math.floor((3980 * ppr) / 100);
assert.match(await c.locator('[data-testid=bag-points]').innerText(), new RegExp('\\+' + expectPoints.toLocaleString('pt-BR').replace('.', '\\.') + ' pts'));
console.log(`6. sacola com 3 itens, total R$ 39,80 e "+${expectPoints} pts" OK`);

await c.click('text=Observação'); await c.fill('#o-note', 'sem granola');
await c.click('[data-testid=bag-continue]'); await c.waitForSelector('text=Como você quer receber');
const body = nb(await c.locator('[role=dialog]').innerText());
assert.match(body, /grátis/); assert.match(body, /pronto em 20 min/); assert.match(body, /R\$ 39,80/);
await c.click('[data-testid=order-confirm]'); await c.waitForSelector('[data-testid=order-done]');
const code = (await c.locator('[data-testid=order-code]').innerText()).trim();
assert.match(code, /^[A-Z2-9]{6}$/);
const row = sql(`select status||'/'||"totalCents"||'/'||"prepMin"||'/'||coalesce(note,'') from "Order" where code='${code}' and "restaurantId"='${rid}'`);
assert.equal(row, 'RECEIVED/3980/20/sem granola');
assert.equal(sql(`select string_agg(qty||'x'||"unitCents"||'x'||"listCents", ',' order by "unitCents" desc) from "OrderItem" where "orderId"=(select id from "Order" where code='${code}' and "restaurantId"='${rid}')`), '2x1590x2800,1x800x800');
console.log(`7. pedido ${code} enviado; preços e total vieram do servidor (R$ 39,80) OK`);

await c.goto(BASE + '/perfil/pedidos'); await c.waitForSelector('[data-testid=my-order]');
const mine = nb(await c.locator('[data-testid=my-order]').first().innerText());
assert.match(mine, new RegExp(code)); assert.match(mine, /Pedido enviado/); assert.match(mine, /2× Açaí Teste 300 ml/); assert.match(mine, /R\$ 39,80/);
console.log('8. "Meus pedidos" mostra o código e o status OK');

// ---- dono recebe e leva o pedido até o fim
await o.goto(BASE + '/dashboard/pedidos'); await o.waitForSelector('[data-testid=order-card]');
const card = o.locator(`[data-testid=order-card]:has-text("${code}")`);
assert.match(nb(await card.innerText()), /Cobrar R\$ 39,80 no balcão/); assert.match(await card.innerText(), /Observação: sem granola/);
assert.match(await card.innerText(), /Lucas|Teste/i);
await card.locator('button:has-text("Começar a preparar")').click();
await until(o, () => sql(`select status from "Order" where code='${code}' and "restaurantId"='${rid}'`) === 'PREPARING', 'preparando');
await o.goto(BASE + '/dashboard/pedidos');
await o.locator(`[data-testid=order-card]:has-text("${code}") button:has-text("Pronto para retirar")`).click();
await until(o, () => sql(`select status from "Order" where code='${code}' and "restaurantId"='${rid}'`) === 'READY', 'pronto');
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and title='Seu pedido está pronto!' and body like '%${code}%'`), '1');
await c.goto(BASE + '/perfil/pedidos'); await c.waitForSelector('text=Pronto para retirar');
assert.equal(await c.locator('[data-testid=my-order] button:has-text("Cancelar pedido")').count(), 0); // depois de preparar, o cliente não cancela sozinho
console.log('9. dono prepara e marca pronto; cliente é avisado e não cancela mais sozinho OK');

await o.goto(BASE + '/dashboard/pedidos');
await o.locator(`[data-testid=order-card]:has-text("${code}") button:has-text("Retirado e pago")`).click();
await until(o, () => sql(`select status from "Order" where code='${code}' and "restaurantId"='${rid}'`) === 'PICKED_UP', 'retirado');
assert.equal(sql(`select "pointsAwarded" from "Order" where code='${code}' and "restaurantId"='${rid}'`), String(expectPoints));
const walletAfter = Number(sql(`select balance from "Wallet" where "customerId"='${cid}' and "restaurantId"='${rid}'`));
assert.equal(walletAfter - (balanceBefore ?? 0), expectPoints);
assert.equal(sql(`select count(*) from "Transaction" t join "Claim" cl on cl.id=t."claimId" where cl."customerId"='${cid}' and cl.description like 'Pedido ${code}%'`), '1');
await o.waitForSelector(`text=O cliente ganhou`);
console.log(`10. "Retirado e pago" credita ${expectPoints} pontos uma única vez e o valor entra nas vendas OK`);

// ---- cancelar pelo cliente (pedido novo, ainda não visto pelo lugar)
await c.goto(BASE + '/lugar/' + rid + '/pedido'); await c.waitForSelector('[data-testid=menu-featured]');
await c.click('button[aria-label="Adicionar Suco Teste à sacola"]'); await c.click('[data-testid=open-bag]');
await c.click('[data-testid=bag-continue]'); await c.click('[data-testid=order-confirm]'); await c.waitForSelector('[data-testid=order-done]');
const code2 = (await c.locator('[data-testid=order-code]').innerText()).trim();
await c.goto(BASE + '/perfil/pedidos');
await c.locator(`[data-testid=my-order]:has-text("${code2}") button:has-text("Cancelar pedido")`).click();
// O que importa é o servidor ter cancelado e mandado para ?cancelado=1. No CI (servidor em modo de desenvolvimento) a tela às vezes não troca o
// conteúdo logo depois da ação (erro de navegador "Event" na navegação); nesse caso recarrega a mesma página e confere o aviso.
await until(c, () => sql(`select status||'/'||"canceledBy" from "Order" where code='${code2}' and "restaurantId"='${rid}'`) === 'CANCELED/CUSTOMER', 'pedido cancelado');
await c.waitForURL('**/perfil/pedidos?cancelado=1');
if (!(await c.locator('text=Pedido cancelado.').first().isVisible({ timeout: 8000 }).catch(() => false))) await c.reload();
await c.waitForSelector('text=Pedido cancelado.');
console.log('11. cliente cancela um pedido que o lugar ainda não começou OK');

// ---- limite de pedidos em aberto
for (let i = 0; i < 3; i++) {
  sql(`insert into "Order"(id,"restaurantId","customerId",code,status,"totalCents","prepMin") values (gen_random_uuid(),'${rid}','${cid}','ZZZZ2${i}','RECEIVED',800,15)`);
}
await c.goto(BASE + '/lugar/' + rid + '/pedido'); await c.waitForSelector('[data-testid=menu-featured]');
await c.click('button[aria-label="Adicionar Suco Teste à sacola"]'); await c.click('[data-testid=open-bag]');
await c.click('[data-testid=bag-continue]'); await c.click('[data-testid=order-confirm]');
await c.waitForSelector('text=Você já tem pedidos em andamento neste lugar.');
console.log('12. com 3 pedidos em aberto, o quarto é recusado OK');
sql(`delete from "Order" where code like 'ZZZZ2%'`);

// ---- pedidos desligados
sql(`update "Restaurant" set "ordersEnabled"=false where id='${rid}'`);
await c.goto(BASE + '/lugar/' + rid + '/pedido');
await c.waitForSelector('text=não está recebendo pedidos pelo app agora');
await c.goto(BASE + '/lugar/' + rid); await c.waitForSelector('text=Escolher prêmio');
assert.equal(await c.locator('[data-testid=make-order]').count(), 0);
console.log('13. com os pedidos desligados, o botão some e a página explica OK');

// limpeza: devolve o banco como estava
sql(`delete from "Transaction" where "claimId" in (select "claimId" from "Order" where "restaurantId"='${rid}' and "claimId" is not null)`);
sql(`delete from "Order" where "restaurantId"='${rid}'`);
sql(`delete from "Claim" where "restaurantId"='${rid}' and description like 'Pedido %'`);
sql(`delete from "MenuItem" where "restaurantId"='${rid}'`);
if (balanceBefore != null) sql(`update "Wallet" set balance=${balanceBefore} where "customerId"='${cid}' and "restaurantId"='${rid}'`);
await b.close();
console.log('ALL OK (pedidos com retirada)');
