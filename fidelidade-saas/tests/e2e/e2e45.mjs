import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
const r1 = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`delete from "Restaurant" where email like 'avisos-teste-%'`);
const r2 = sql(`insert into "Restaurant"(id,name,email,"passwordHash",phone,"subscriptionStatus","onboardedAt","pointsPerReal","createdAt") values (gen_random_uuid(),'Loja dos Avisos','avisos-teste-${Date.now()}@t.com','x','11900000001','ACTIVE',now(),5,now()) returning id`).split('\n')[0];
const n1 = sql(`select name from "Restaurant" where id='${r1}'`), n2 = sql(`select name from "Restaurant" where id='${r2}'`);
sql(`delete from "Notification" where "customerId"='${cid}'`);
// Horários ancorados no começo do dia de Brasília (e não em "agora menos X"): perto da meia-noite, "agora − 30 min" cai em ontem e o teste
// passava a ver 4 dias em vez de 3.
const today0 = `(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;
sql(`insert into "Notification" (id,"customerId","restaurantId",title,body,href,"createdAt","readAt") values
 (gen_random_uuid(),'${cid}','${r1}','Você ganhou 940 pontos','Faltam 160 pontos','/lugar/${r1}',${today0}+interval '2 seconds',null),
 (gen_random_uuid(),'${cid}','${r1}','Seu pedido está pronto','Retire no balcão. Código 4F7K.','/perfil/pedidos',${today0}+interval '1 second',null),
 (gen_random_uuid(),'${cid}','${r2}','Agendamento confirmado','Corte com Lucas amanhã às 11:00.','/perfil/agendamentos',${today0}-interval '6 hours',null),
 (gen_random_uuid(),'${cid}','${r1}','Resgate confirmado','Pastel de nata entregue.',null,${today0}-interval '5 days',now())`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');

// abre todos os dias fechados (um toque em cada data)
const openAll = async () => { await c.locator('[data-testid=notice-day] button[aria-expanded=false]').evaluateAll((bs) => bs.forEach((b) => b.click())); };

// 1. avisos agrupados por dia, do mais recente ao mais antigo; todos os dias começam fechados
await c.goto(BASE + '/avisos'); await c.waitForSelector('[data-testid=notice-groups]');
const labels = await c.locator('[data-testid=notice-groups] h2').allInnerTexts();
assert.match(labels[0], /^hoje/i); assert.match(labels[1], /^ontem|^\w{3}, \d{2}\/\d{2}/i); assert.equal(labels.length, 3, `3 dias: ${labels}`);
assert.equal(await c.locator('[data-testid=notice-day] button[aria-expanded=true]').count(), 0, 'todas as datas fechadas');
assert.equal(await c.locator('[data-testid=notice-groups] li').count(), 0, 'sem avisos à mostra com as datas fechadas');
assert.ok(await c.locator('[data-testid=notice-day]:has-text("novo")').count(), 'a data mostra quantos avisos são novos');
await openAll();
await c.waitForSelector('[data-testid=notice-groups] li');
assert.equal(await c.locator('[data-testid=notice-groups] li:has-text("Você ganhou 940 pontos")').count(), 1);
console.log('1. avisos agrupados por dia, datas fechadas e com selo de novos OK', labels.map((l) => l.split('·')[0].trim()).join(' | '));

// 2. filtro por estabelecimento: chips com contagem; o lugar escolhido mostra só os dele
await c.waitForSelector('nav[aria-label="Filtrar por estabelecimento"]');
assert.ok(await c.locator(`nav[aria-label="Filtrar por estabelecimento"] a:has-text("Todos")`).count());
await c.locator(`nav[aria-label="Filtrar por estabelecimento"] a[href="/avisos?lugar=${r2}"]`).click();
await c.waitForURL(`**/avisos?lugar=${r2}`);
await c.waitForSelector('[data-testid=notice-day]'); await openAll();
await c.waitForSelector('text=Agendamento confirmado');
assert.equal(await c.locator('text=Você ganhou 940 pontos').count(), 0, 'avisos do outro lugar saem');
console.log('2. filtro por estabelecimento OK', n2);

// 3. abrir as datas de um lugar só marca como lido os avisos dele; os do outro continuam novos
await c.waitForTimeout(3200);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and "readAt" is null and "restaurantId"='${r2}'`), '0');
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and "readAt" is null and "restaurantId"='${r1}'`), '2');
console.log('3. marcar como lido só do lugar aberto OK');

// 4. Todos de novo: os do outro lugar ainda aparecem como novos e saem depois de lidos
await c.goto(BASE + '/avisos'); await c.waitForSelector('[data-testid=notice-groups]'); await c.waitForTimeout(3200);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and "readAt" is null`), '2', 'só abrir a tela não marca nada como lido');
await openAll(); await c.waitForTimeout(3200);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and "readAt" is null`), '0');
console.log('4. abrir a tela não marca como lido; abrir as datas marca OK');

// 4b. "Marcar tudo como lido" para quem não quer abrir dia por dia
sql(`insert into "Notification"(id,"customerId","restaurantId",title,body,"createdAt") values (gen_random_uuid()::text,'${cid}','${r1}','Aviso novo de teste','corpo',now())`);
await c.goto(BASE + '/avisos'); await c.waitForSelector('[data-testid=mark-all-read]');
await c.click('[data-testid=mark-all-read]');
for (let i = 0; i < 30 && sql(`select count(*) from "Notification" where "customerId"='${cid}' and "readAt" is null`) !== '0'; i++) await c.waitForTimeout(250);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and "readAt" is null`), '0');
sql(`delete from "Notification" where "customerId"='${cid}' and title='Aviso novo de teste'`);
console.log('4b. marcar tudo como lido OK');

// 4c. filtro por mês: um aviso de 45 dias atrás cria o mês anterior; escolher o mês mostra só os dele
sql(`insert into "Notification"(id,"customerId","restaurantId",title,"body","createdAt","readAt") values (gen_random_uuid()::text,'${cid}','${r1}','Aviso antigo de teste','corpo',now()-interval '45 days',now())`);
const oldYm = new Date(Date.now() - 45 * 864e5 - 3 * 3600e3).toISOString().slice(0, 7);
await c.goto(BASE + '/avisos'); await c.waitForSelector('nav[aria-label="Filtrar por mês"]');
assert.ok((await c.locator('nav[aria-label="Filtrar por mês"] a').count()) >= 3, 'Todos os meses + os meses com aviso');
await c.click(`nav[aria-label="Filtrar por mês"] a[href*="mes=${oldYm}"]`);
await c.waitForURL(`**mes=${oldYm}`); await c.waitForSelector('[data-testid=notice-day]'); await openAll();
await c.waitForSelector('text=Aviso antigo de teste');
assert.equal(await c.locator('[data-testid=notice-groups] li').count(), 1, 'só o aviso do mês escolhido');
await c.click('nav[aria-label="Filtrar por mês"] a:has-text("Todos os meses")');
await c.waitForURL((u) => !u.search.includes('mes=')); await c.waitForSelector('[data-testid=notice-day]');
assert.ok((await c.locator('[data-testid=notice-day]').count()) >= 4, 'todos os meses de volta');
sql(`delete from "Notification" where "customerId"='${cid}' and title='Aviso antigo de teste'`);
console.log('4c. filtro por mês OK');

// 5. Início: resumo, carteiras, atividade recente
sql(`insert into "Wallet" (id,"customerId","restaurantId",balance,"createdAt") values (gen_random_uuid(),'${cid}','${r1}',700,now()) on conflict ("customerId","restaurantId") do update set balance=700`);
const w = sql(`select id from "Wallet" where "customerId"='${cid}' and "restaurantId"='${r1}'`);
sql(`delete from "Transaction" where "walletId"='${w}'; insert into "Transaction" (id,"walletId",type,points,description,"createdAt") values (gen_random_uuid(),'${w}','EARN',700,'Compra de R$ 70,00 (teste do início)',now()-interval '2 minutes')`);
await c.goto(BASE + '/carteira'); await c.waitForSelector('[data-testid=home-summary]');
assert.ok(await c.locator('[data-testid=home-summary]:has-text("Saldo total")').count());
assert.ok(await c.locator('[data-testid=home-summary]:has-text("no mês")').count());
await c.waitForSelector('text=Suas carteiras');
await c.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); } });
await c.waitForSelector('text=Atividade recente'); await c.waitForSelector('text=Compra de R$ 70,00 (teste do início)');
const overflow = await c.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
assert.equal(overflow, false, 'sem rolagem lateral no Início');
console.log('5. Início: resumo, carteiras e atividade recente OK');

await b.close();
sql(`delete from "Restaurant" where email like 'avisos-teste-%'`);
console.log('ALL OK (Início e Avisos)');
