// Painel do gestor, ajustes de leitura no celular: novidades de Avaliações e Indicações somem do Início depois que o dono abre a tela;
// "Próximo/Anterior" também no alto das etapas de Regras; lista de desafios e prévia da campanha legíveis (texto sem quebrar palavra a palavra).
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const PHOTO = readFileSync(fileURLToPath(new URL('./fixtures/prato.png', import.meta.url)));
sql(`truncate "RateLimit"; delete from "Review"; delete from "PostReport"; delete from "PostLike"; delete from "PostPhoto"; delete from "Post"; delete from "Booking"; update "Restaurant" set "guideDoneAt"=now(), "reviewsSeenAt"=now()-interval '1 hour', "postsSeenAt"=now()-interval '1 hour' where email='ze@burger.com'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
sql(`delete from "Challenge" where "restaurantId"='${rid}'; delete from "Promotion" where "restaurantId"='${rid}'`);
sql(`insert into "Challenge"(id,"restaurantId",title,kind,target,"minAmountCents",period,"bonusPoints") values (gen_random_uuid(),'${rid}','x','PURCHASES',2,3500,'WEEK',100)`);
// uma avaliação e uma indicação novas (depois da "última visita" de 1 hora atrás)
const bk = sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","completedAt") values (gen_random_uuid()::text,'${rid}','${unit}','${lucas}',now()-interval '3 hour',now()-interval '2 hour','COMPLETED','Corte',60,5000,now()-interval '2 hour') returning id`).split('\n')[0];
sql(`insert into "Review"(id,"restaurantId","customerId","bookingId","placeRating") values (gen_random_uuid()::text,'${rid}','${lucas}','${bk}',5)`);
const post = sql(`insert into "Post"(id,"customerId","restaurantId",rating,comment) values (gen_random_uuid()::text,'${lucas}','${rid}',4,'Muito bom') returning id`).split('\n')[0];
sql(`insert into "PostPhoto"("postId",mime,data) values ('${post}','image/png', decode('${PHOTO.toString('hex')}','hex'))`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');

// 1. Início: avaliação e indicação novas aparecem como novidade; abrir a tela zera
await o.waitForSelector('[data-testid=inbox-hub]');
assert.match(await o.locator('[data-testid=reviews-shortcut]').innerText(), /1 nova/);
assert.match(await o.locator('[data-testid=posts-shortcut]').innerText(), /1 nova/);
await o.click('[data-testid=reviews-shortcut]'); await o.waitForURL('**/dashboard/avaliacoes');
await o.waitForSelector('[data-testid=review-new]');
await o.click('[data-testid=owner-back]'); await o.waitForURL('**/dashboard');
await o.waitForSelector('[data-testid=inbox-hub]');
assert.doesNotMatch(await o.locator('[data-testid=reviews-shortcut]').innerText(), /nova/);
assert.match(await o.locator('[data-testid=posts-shortcut]').innerText(), /1 nova/, 'a das fotos continua até abrir as fotos');
await o.click('[data-testid=posts-shortcut]'); await o.waitForURL('**/dashboard/indicacoes');
await o.waitForSelector('[data-testid=post-new]');
await o.goto(BASE + '/dashboard'); await o.waitForSelector('[data-testid=inbox-hub]');
assert.doesNotMatch(await o.locator('[data-testid=posts-shortcut]').innerText(), /nova/);
assert.equal(await o.locator('[data-testid=inbox-hub] .bg-rose-500').count(), 0, 'sem bolinhas vermelhas depois de ver tudo');
console.log('1. a novidade de Avaliações e Indicações some do Início depois que o dono abre a tela OK');

// 2. Regras: Próximo/Anterior também no alto da etapa
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras'); await o.waitForSelector('[data-testid=etapa-nav-top]');
const top = await o.locator('[data-testid=etapa-nav-top]').boundingBox();
assert.ok(top.y < 400, `navegação no alto (${Math.round(top.y)})`);
const label = (await o.locator('[data-testid=etapa-nav-top] a:has-text("Próximo")').innerText()).trim();
await o.click('[data-testid=etapa-nav-top] a:has-text("Próximo")'); await o.waitForURL(/etapa=/);
assert.ok(label.startsWith('Próximo:'));
await o.screenshot({ path: 'regras-topo.png' });
console.log('2. "Próximo" e "Anterior" também no alto de cada etapa de Regras OK');

// 3. desafios legíveis: o texto ocupa a largura da linha e os botões ficam embaixo
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=desafios'); await o.waitForSelector('[data-testid=challenge-row]');
const rowBox = await o.locator('[data-testid=challenge-row]').first().boundingBox();
const textBox = await o.locator('[data-testid=challenge-row] p').first().boundingBox();
assert.ok(textBox.width > rowBox.width * 0.6, `texto do desafio largo (${Math.round(textBox.width)} de ${Math.round(rowBox.width)})`);
assert.ok(textBox.height < 60, `texto em poucas linhas (${Math.round(textBox.height)}px)`);
await o.screenshot({ path: 'desafios.png' });
console.log('3. lista de desafios legível no celular OK');

// 4. prévia da campanha: título, "Valendo agora" e quando vale não se sobrepõem
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=campanhas'); await o.waitForSelector('[data-testid=promo-preview]');
const tile = o.locator('[data-testid=promo-preview]');
const t = await tile.locator('p.font-bold').boundingBox(); const chip = await tile.locator('.chip-verde').boundingBox(); const when = await tile.locator('p.text-xs').boundingBox();
assert.ok(chip.y >= t.y + t.height - 2, 'o selo fica abaixo do título');
assert.ok(when.y >= chip.y + chip.height - 2, 'o texto de quando vale fica abaixo do selo');
assert.ok(when.height < 40, `"Todos os dias" em uma linha (${Math.round(when.height)}px)`);
await o.locator('[data-testid=promo-preview]').scrollIntoViewIfNeeded(); await o.screenshot({ path: 'campanha-previa.png' });
console.log('4. prévia da campanha sem sobreposição OK');

// 5. cliente: abrir o dia nos Avisos marca como lido na hora (a bolinha e o "novo" somem em menos de 2 s e o servidor confirma)
sql(`delete from "Notification" where "customerId"='${lucas}'`);
sql(`insert into "Notification"(id,"customerId","restaurantId",title,body) values (gen_random_uuid()::text,'${lucas}','${rid}','Seu pedido está pronto!','Pedido ABC · Burger do Zé.'), (gen_random_uuid()::text,'${lucas}','${rid}','+100 pontos','Compra lançada.')`);
const cctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await cctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await cctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await c.goto(BASE + '/avisos'); await c.waitForSelector('[data-testid=notice-day]:has-text("novos")');
await c.click('[data-testid=notice-day] button');
await c.waitForSelector('[data-testid=notice-day]:has-text("novos")', { state: 'detached', timeout: 2000 });
for (let i = 0; i < 20 && sql(`select count(*) from "Notification" where "customerId"='${lucas}' and "readAt" is null`) !== '0'; i++) await c.waitForTimeout(150);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and "readAt" is null`), '0');
console.log('5. abrir o dia nos Avisos marca como lido na hora OK');

await b.close();
console.log('ALL OK (painel: leitura no celular)');
