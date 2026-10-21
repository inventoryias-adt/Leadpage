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

// 1. avisos agrupados por dia, do mais recente ao mais antigo
await c.goto(BASE + '/avisos'); await c.waitForSelector('[data-testid=notice-groups]');
const labels = await c.locator('[data-testid=notice-groups] h2').allInnerTexts();
assert.match(labels[0], /^hoje/i); assert.match(labels[1], /^ontem|^\w{3}, \d{2}\/\d{2}/i); assert.equal(labels.length, 3, `3 dias: ${labels}`);
assert.equal(await c.locator('[data-testid=notice-groups] li:has-text("Você ganhou 940 pontos")').count(), 1);
console.log('1. avisos agrupados por dia OK', labels.map((l) => l.split('·')[0].trim()).join(' | '));

// 2. filtro por estabelecimento: chips com contagem; o lugar escolhido mostra só os dele
await c.waitForSelector('nav[aria-label="Filtrar por estabelecimento"]');
assert.ok(await c.locator(`nav[aria-label="Filtrar por estabelecimento"] a:has-text("Todos")`).count());
await c.locator(`nav[aria-label="Filtrar por estabelecimento"] a[href="/avisos?lugar=${r2}"]`).click();
await c.waitForURL(`**/avisos?lugar=${r2}`);
await c.waitForSelector('text=Agendamento confirmado');
assert.equal(await c.locator('text=Você ganhou 940 pontos').count(), 0, 'avisos do outro lugar saem');
console.log('2. filtro por estabelecimento OK', n2);

// 3. abrir um lugar só marca como lido os avisos dele; os do outro continuam novos
await c.waitForTimeout(3200);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and "readAt" is null and "restaurantId"='${r2}'`), '0');
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and "readAt" is null and "restaurantId"='${r1}'`), '2');
console.log('3. marcar como lido só do lugar aberto OK');

// 4. Todos de novo: os do outro lugar ainda aparecem como novos e saem depois de lidos
await c.goto(BASE + '/avisos'); await c.waitForSelector('[data-testid=notice-groups]'); await c.waitForTimeout(3200);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and "readAt" is null`), '0');
console.log('4. Todos marca o resto como lido OK');

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
