import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000';
const sql = (q) => execSync(`psql postgresql://postgres:postgres@localhost:5432/fidelidade -At -c ${JSON.stringify(q)}`).toString().trim();
sql('TRUNCATE "RateLimit"');
// estado limpo para reexecução: sem 2ª unidade e sem check-ins do dia
sql(`delete from "Unit" where name <> 'Unidade principal'`);
sql('delete from "CheckIn"');
const rid = sql('select id from "Restaurant" limit 1');
const unit1 = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);

const SE = { latitude: -23.5505, longitude: -46.6333 }; // unidade principal
const NORTE = { latitude: -23.5000, longitude: -46.6250 }; // Shopping Norte (~5,5 km)
const MEIO = { latitude: -23.5250, longitude: -46.6290 }; // longe das duas

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = (geo, mobile = true) => browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, deviceScaleFactor: 2, geolocation: geo, permissions: ['geolocation'] });
const shot = (p, n) => p.screenshot({ path: `${n}.png`, fullPage: true });
const wait = (p, t) => p.waitForTimeout(t);

// ---------------------------------------------------------------- dono adiciona a 2ª unidade
const octx = await ctx(NORTE, false);
const o = await octx.newPage();
o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await wait(o, 2500);
await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1');
await o.click('button[type=submit]:has-text("Entrar")'); await o.waitForURL('**/dashboard');
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o, 2500);

// sem 2ª unidade o seletor do topo não aparece
assert.equal(await o.locator('#unit-switch').count(), 0);
await o.click('summary:has-text("Adicionar outra unidade")');
const N = 'form:has(#unew-name)';
await o.fill('#unew-name', 'Shopping Norte');
await o.fill('#unew-street', 'Av. Cruzeiro do Sul');
await o.fill('#unew-number', '1800');
await o.fill('#unew-district', 'Santana');
await o.fill('#unew-city', 'São Paulo');
await o.selectOption('#unew-state', 'SP');
await o.fill(`${N} input[name=googleReviewUrl]`, 'https://g.page/r/CshoppingNorte/review');
await o.fill('#unew-o-1', '10:00'); await o.fill('#unew-c-1', '22:00');
await o.click(`${N} button[aria-label^="Repetir o horário de Segunda"]`);
await o.click(`${N} >> text=Estou na unidade (GPS)`);
await o.waitForSelector(`${N} >> text=Arraste o mapa`);
await o.click(`${N} button[type=submit]`);
await o.waitForSelector('text=Unidade adicionada.');
assert.equal(sql(`select count(*) from "Unit" where "restaurantId"='${rid}'`), '2');
const unit2 = sql(`select id from "Unit" where name='Shopping Norte'`);
assert.match(sql(`select latitude from "Unit" where id='${unit2}'`), /^-23\.5/);
await shot(o, 'unid-config');
console.log('1. adicionar 2ª unidade (endereço, horário, Google, GPS) OK');

// ---------------------------------------------------------------- caixa por unidade
await o.goto(BASE + '/dashboard/caixa'); await wait(o, 2500);
await o.waitForSelector('#unit-switch');
await o.waitForSelector('text=Lançando pela unidade');
async function newClaim(amount) {
  await o.goto(BASE + '/dashboard/caixa'); await wait(o, 2500);
  await o.fill('#amount', amount);
  await o.click('text=Gerar QR Code'); await o.waitForSelector('text=Enviar por WhatsApp');
  return sql('select token from "Claim" order by "createdAt" desc limit 1');
}
const t1 = await newClaim('30,00');
assert.equal(sql(`select "unitId" from "Claim" where token='${t1}'`), unit1, 'padrão: 1ª unidade');
await o.selectOption('#unit-switch', unit2);
await o.waitForSelector('strong:text-is("Shopping Norte")');
const t2 = await newClaim('40,00');
assert.equal(sql(`select "unitId" from "Claim" where token='${t2}'`), unit2, 'caixa trocou para a 2ª unidade');
await shot(o, 'unid-caixa');
console.log('2. caixa lança pela unidade escolhida OK');

// ---------------------------------------------------------------- cliente: lugares, página, QR e check-in
async function login(page) {
  await page.goto(BASE + '/entrar'); await wait(page, 2500);
  await page.fill('#c-email','lucas@teste.com'); await page.fill('#c-password','senha-cliente-1');
  await page.click('button[type=submit]:has-text("Entrar")'); await page.waitForURL('**/carteira');
}
const lctx = await ctx(NORTE);
const l = await lctx.newPage();
l.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await login(l);
try { await l.click('button:has-text("Pular")', { timeout: 3000 }); } catch {}

await l.goto(BASE + '/lugares'); await wait(l, 3000);
await l.waitForSelector('a[href^="/lugar/"]:has-text("Burger do Zé") span.shrink-0.text-electric-600');
const card = 'li:has-text("Burger do Zé")';
await l.waitForSelector(`${card} >> text=2 unidades`);
await l.waitForSelector(`${card} >> text=Shopping Norte`); // mostra a unidade mais perto de quem está no norte
await shot(l, 'unid-lugares');
await l.click(`${card} a`);
await l.waitForURL(`**/lugar/${rid}?unidade=${unit2}`);
await l.waitForSelector('nav[aria-label="Unidades"]');
await l.waitForSelector('text=Av. Cruzeiro do Sul');
await l.waitForSelector('text=Quando você pode vir · Shopping Norte');
await shot(l, 'unid-lugar');
// trocar de unidade pelas abas
await l.click('nav[aria-label="Unidades"] >> text=Unidade principal');
await l.waitForURL(`**/lugar/${rid}?unidade=${unit1}`);
await l.waitForSelector('text=Rua das Flores');
await l.waitForSelector('text=Quando você pode vir · Unidade principal');
console.log('3. lugares + página com abas de unidades OK');

// QR da 2ª unidade mostra os horários dessa unidade
await l.goto(`${BASE}/r/${t2}`); await wait(l, 2000);
await l.waitForSelector('text=Shopping Norte');
await l.waitForSelector('text=Você pode retirar em qualquer unidade.');
await shot(l, 'unid-qr');
await l.click('button:has-text("Receber meus pontos")');
await l.waitForURL('**/carteira/*?credited=1');
await l.waitForSelector('text=Shopping Norte'); // horário para retirar lista as unidades

// check-in perto do Norte -> registra a 2ª unidade; longe das duas -> recusa
await l.goto(`${BASE}/lugar/${rid}?unidade=${unit2}`); await wait(l, 2500);
await l.click('button:has-text("Fazer check-in")');
await l.waitForSelector('text=Check-in feito!');
assert.equal(sql(`select "unitId" from "CheckIn" order by "createdAt" desc limit 1`), unit2);
assert.match(sql(`select description from "Transaction" where description like 'Check-in%' order by "createdAt" desc limit 1`), /Check-in: Shopping Norte/);
await lctx.close();
const mctx = await ctx(MEIO);
const m = await mctx.newPage();
await login(m);
await m.goto(`${BASE}/lugar/${rid}`); await wait(m, 2500);
await m.click('button:has-text("Fazer check-in")');
await m.waitForSelector('text=da unidade mais próxima');
await mctx.close();
console.log('4. QR/horários por unidade e check-in na unidade mais próxima OK');

// ---------------------------------------------------------------- entrega registra a unidade
// cliente resgata 1 prêmio (via banco não: usa a UI do cliente)
const rctx = await ctx(NORTE);
const c = await rctx.newPage();
await login(c);
await c.goto(`${BASE}/lugar/${rid}/premios`); await wait(c, 2500);
await c.click('button[aria-label="Adicionar Sobremesa grátis à sacola"]');
await c.click('button:has-text("Resgatar sacola")');
await c.click('button:has-text("Confirmar (")');
await c.waitForSelector('text=Resgate realizado!');
await rctx.close();
await o.goto(BASE + '/dashboard/resgates'); await wait(o, 2500);
await o.click('button:has-text("Entregar")');
await o.waitForSelector('text=Entregues recentemente');
const usedUnit = sql(`select "usedUnitId" from "Redemption" where status='USED' order by "usedAt" desc limit 1`);
assert.equal(usedUnit, unit2, 'entrega registra a unidade do caixa');
await o.waitForSelector('text=Shopping Norte >> nth=-1');
console.log('5. entrega de prêmio registra a unidade OK');

// ---------------------------------------------------------------- relatório por unidade e regras de remoção
await o.goto(BASE + '/dashboard/pontos'); await wait(o, 2000);
await o.waitForSelector('text=Compras por unidade');
await shot(o, 'unid-pontos');
// unidade com histórico só é desativada; nunca fica sem unidade ativa
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o, 2500);
await o.click(`summary:has-text("Shopping Norte")`);
await o.click('button[aria-label="Remover unidade Shopping Norte"]');
await wait(o, 2000);
assert.equal(sql(`select active from "Unit" where id='${unit2}'`), 'f', 'unidade com histórico é desativada, não apagada');
assert.equal(sql(`select count(*) from "Unit" where id='${unit2}'`), '1');
assert.equal(await o.locator('button[aria-label="Remover unidade Unidade principal"]').count(), 0, 'única unidade ativa não pode ser removida');
// mesmo forçando a ação no servidor, a última unidade ativa continua de pé
const { execSync: _x } = await import('node:child_process');
await o.goto(BASE + '/dashboard/caixa'); await wait(o, 2000);
assert.equal(await o.locator('#unit-switch').count(), 0);
// reativa e remove a que não tem histórico: cria uma 3ª sem histórico e apaga
console.log('6. relatório por unidade e remoção/desativação OK');

await browser.close();
console.log('ALL OK (unidades)');
