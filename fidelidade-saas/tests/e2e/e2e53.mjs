// "Promoções de hoje" em Lugares: carrossel com todo produto em promoção que ainda vale (foto, "Restam N", preço novo e riscado),
// janela com quanto resta, prazo e "Pedir"; esgotado, vencido e sem promoção não aparecem.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const wait = (p, t) => p.waitForTimeout(t);
const nb = (s) => s.replace(/\u00a0/g, ' ');

sql('truncate "RateLimit"');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`update "Restaurant" set "ordersEnabled"=true, "orderPrepMin"=15, listed=true, "onboardedAt"=coalesce("onboardedAt",now()) where id='${rid}'`);
sql(`update "Unit" set active=true where "restaurantId"='${rid}'`);
sql(`delete from "Order" where "restaurantId"='${rid}'; delete from "MenuItem" where "restaurantId"='${rid}'`);
const item = (name, price, promo, extra = '') => sql(`insert into "MenuItem"(id,"restaurantId",name,"priceCents","promoCents",active ${extra ? ',' + extra.split('|')[0] : ''}) values (gen_random_uuid(),'${rid}','${name}',${price},${promo ?? 'null'},true ${extra ? ',' + extra.split('|')[1] : ''}) returning id`).split('\n')[0];
const a = item('Açaí Promo A', 2800, 1590, `"offerStock","offerStockTotal","offerEndsAt"|15,20,now() + interval '2 days'`);
const bId = item('Açaí Promo B', 1500, 900);
item('Açaí Esgotado', 1000, 500, `"offerStock","offerStockTotal"|0,10`);
item('Açaí Vencido', 1000, 500, `"offerEndsAt"|now() - interval '1 day'`);
item('Açaí Sem Promo', 1000, null);

const init = () => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } }); await ctx.addInitScript(init);
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');

// 1. a faixa aparece no topo de Lugares, antes da lista; só as promoções que ainda valem
await c.goto(BASE + '/lugares'); await c.waitForSelector('[data-testid=today-deals]');
const section = c.locator('[data-testid=today-deals]');
assert.equal(await section.locator('[data-testid=deal-card]').count(), 2, 'só A e B (sem esgotado, vencido nem sem promoção)');
const txt = nb(await section.innerText());
assert.match(txt, /Promoções de hoje/); assert.match(txt, /2 ofertas/);
assert.match(txt, /Açaí Promo A/); assert.match(txt, /R\$ 15,90/); assert.match(txt, /R\$ 28,00/); assert.match(txt, /-43%/);
assert.doesNotMatch(txt, /Esgotado|Vencido|Sem Promo/);
const cardA = section.locator('[data-testid=deal-card]:has-text("Promo A")');
assert.match(nb(await cardA.locator('[data-testid=deal-stock]').innerText()), /restam 15/i);
assert.equal(await section.locator('[data-testid=deal-card]:has-text("Promo B") [data-testid=deal-stock]').count(), 0, 'sem estoque cadastrado: sem selo de quantidade');
const top = await section.boundingBox(); const list = await c.locator('text=Todos os lugares').first().boundingBox();
assert.ok(top.y < list.y, 'a faixa vem antes da lista de lugares');
console.log('1. Promoções de hoje no topo de Lugares: só as que valem, com "Restam 15", preço riscado e % de desconto OK');

// 2. tocar abre os detalhes: quanto resta, prazo e Pedir
await cardA.click(); await c.waitForSelector('[data-testid=deal-modal]');
const modal = c.locator('[data-testid=deal-modal]');
const mtxt = nb(await modal.innerText());
assert.match(mtxt, /Açaí Promo A/); assert.match(mtxt, /R\$ 15,90/); assert.match(mtxt, /restam 15 de 20/); assert.match(mtxt, /Burger do Zé/);
assert.equal(await modal.locator('[role=progressbar]').getAttribute('aria-valuenow'), '75');
assert.match(await modal.locator('[data-testid=deal-order]').getAttribute('href'), new RegExp(`/lugar/${rid}/pedido\\?item=${a}`));
await c.keyboard.press('Escape'); await c.waitForFunction(() => !document.querySelector('[data-testid=deal-modal]'));
console.log('2. tocar na oferta abre os detalhes (restam 15 de 20, barra de 75%, lugar e Pedir) e Esc fecha OK');

// 3. sem limite de unidades: a janela explica
await section.locator('[data-testid=deal-card]:has-text("Promo B")').click(); await c.waitForSelector('[data-testid=deal-modal]');
assert.match(nb(await c.locator('[data-testid=deal-remaining]').innerText()), /Sem limite de unidades/);
await c.locator('[data-testid=deal-modal] button:has-text("Fechar")').click();
console.log('3. oferta sem estoque cadastrado diz que não tem limite OK');

// 4. "Pedir" leva ao pedido com o item já na sacola
await cardA.click(); await c.waitForSelector('[data-testid=deal-order]');
await c.click('[data-testid=deal-order]'); await c.waitForURL(`**/pedido?item=${a}**`);
assert.match(nb(await c.locator('[data-testid=bag-total]').innerText()), /R\$ 15,90/);
console.log('4. "Pedir" abre o pedido com a oferta na sacola (R$ 15,90) OK');

// 5. acabando: selo "Últimas N" e aviso na janela; esgotou: sai da faixa
sql(`update "MenuItem" set "offerStock"=2 where id='${a}'`);
await c.goto(BASE + '/lugares'); await c.waitForSelector('[data-testid=today-deals]');
assert.match(nb(await c.locator('[data-testid=deal-card]:has-text("Promo A") [data-testid=deal-stock]').innerText()), /últimas 2/i);
await c.locator('[data-testid=deal-card]:has-text("Promo A")').click();
assert.match(nb(await c.locator('[data-testid=deal-remaining]').innerText()), /Está acabando!/);
await c.keyboard.press('Escape');
sql(`update "MenuItem" set "offerStock"=0 where id='${a}'`);
await c.goto(BASE + '/lugares'); await c.waitForSelector('[data-testid=today-deals]');
assert.equal(await c.locator('[data-testid=deal-card]').count(), 1, 'esgotada, só sobra a B');
console.log('5. acabando mostra "Últimas 2" e "Está acabando!"; esgotada sai da faixa OK');

// 6. o filtro "Em promoção" também considera as ofertas
await c.getByRole('button', { name: 'Em promoção' }).click();
assert.ok(await c.locator('[data-testid=deal-card]').count() >= 1);
sql(`delete from "MenuItem" where "restaurantId"='${rid}'`);
await c.goto(BASE + '/lugares'); await c.waitForSelector('text=Todos os lugares');
assert.equal(await c.locator('[data-testid=today-deals]').count(), 0, 'sem promoção, a faixa some');
console.log('6. filtro Em promoção inclui as ofertas; sem promoção a faixa some OK');

await b.close();
console.log('ALL OK (promoções de hoje)');
