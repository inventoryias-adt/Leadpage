import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const sql=(q)=>execSync(`psql postgresql://postgres:postgres@localhost:5432/fidelidade -At -c ${JSON.stringify(q)}`).toString().trim();
sql('TRUNCATE "RateLimit"'); sql('delete from "PromotionUse"'); sql('delete from "Promotion"'); sql('update "Restaurant" set "guideDoneAt"=now()');
sql(`delete from "Customer" where cpf='11144477735'`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const wait=(p,t)=>p.waitForTimeout(t);
const o = await (await browser.newContext({ viewport:{width:1280,height:900} })).newPage();
o.on('pageerror',e=>console.log('PAGEERROR',e.message));
await o.goto(BASE+'/login'); await wait(o,2500);
await o.fill('#email','ze@burger.com'); await o.fill('#password','senha-segura-1');
await o.click('button:has-text("Entrar")'); await o.waitForURL('**/dashboard');
const ppr = Number(sql('select "pointsPerReal" from "Restaurant" limit 1'));

// campanha só para clientes novos (+100) e outra para quem sumiu (2x)
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o,2500);
await o.fill('#p-title','Boas-vindas');
await o.selectOption('#p-kind','BONUS'); await o.fill('#p-bonus','100');
await o.selectOption('#p-audience','NEW');
await o.click('button:has-text("Criar campanha")'); await o.waitForSelector('li:has-text("Boas-vindas"):has-text("primeira compra")');
await o.fill('#p-title','Volta pra gente'); await o.selectOption('#p-kind','MULTIPLIER');
await o.selectOption('#p-audience','INACTIVE'); await o.fill('#p-inactive','30');
await o.click('button:has-text("Criar campanha")'); await o.waitForSelector('li:has-text("Volta pra gente"):has-text("não compra há 30 dias")');
console.log('1. campanhas por público criadas OK');

async function newClaim(amount){
  await o.goto(BASE+'/dashboard/caixa'); await wait(o,2500);
  await o.waitForSelector('text=Campanha por público');
  await o.fill('#amount',amount);
  await o.click('text=Gerar QR Code'); await o.waitForSelector('text=Enviar por WhatsApp');
  return sql('select token from "Claim" order by "createdAt" desc limit 1');
}
const cctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true });
await cctx.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const c = await cctx.newPage();
c.on('pageerror',e=>console.log('PAGEERROR',e.message));

// compra 1: cliente novo → +100
let token = await newClaim('50,00');
const base = 50*ppr;
await c.goto(BASE+'/r/'+token); await wait(c,2500);
await c.click('[role=tab]:has-text("Criar conta")'); await c.fill('#s-name','Cliente Novo'); await c.fill('#s-cpf','111.444.777-35'); await c.fill('#s-phone','11988887777'); await c.fill('#s-email','novo@teste.com'); await c.fill('#s-password','senha-cliente-1');
await c.click('text=Receber meus pontos'); await c.waitForURL('**/carteira/*?credited=1');
let row = sql(`select points||'|'||description from "Claim" where token='${token}'`);
console.log(row);
assert.ok(row.startsWith(`${base+100}|`) && row.includes('+100 pontos · Boas-vindas'));
assert.equal(sql(`select balance from "Wallet" w join "Customer" c on c.id=w."customerId" where c.cpf='11144477735'`), String(base+100));
assert.equal(sql(`select count(*)||'|'||sum(points) from "PromotionUse" where title='Boas-vindas'`), '1|100');
console.log('2. cliente novo recebe o bônus da primeira compra OK');

// compra 2: já não é novo → sem bônus
token = await newClaim('50,00');
await c.goto(BASE+'/r/'+token); await wait(c,2500);
await c.click('text=Receber meus pontos'); await c.waitForURL('**/carteira/*?credited=1');
row = sql(`select points from "Claim" where token='${token}'`);
assert.equal(row, String(base));
assert.equal(sql(`select count(*) from "PromotionUse" where title='Boas-vindas'`), '1');
console.log('3. segunda compra não repete o bônus OK');

// compra 3: 40 dias sem comprar → 2x
sql(`update "Claim" set "redeemedAt"=now()-interval '40 days' where "customerId"=(select id from "Customer" where cpf='11144477735') and "redeemedAt" is not null`);
token = await newClaim('50,00');
await c.goto(BASE+'/r/'+token); await wait(c,2500);
await c.click('text=Receber meus pontos'); await c.waitForURL('**/carteira/*?credited=1');
row = sql(`select points||'|'||description from "Claim" where token='${token}'`);
console.log(row);
assert.ok(row.startsWith(`${base*2}|`) && row.includes('2x pontos · Volta pra gente'));
assert.equal(sql(`select points from "PromotionUse" where title='Volta pra gente'`), String(base));
console.log('4. quem sumiu há 30+ dias recebe o 2x OK');

// compra 4: voltou há pouco → sem campanha
token = await newClaim('50,00');
await c.goto(BASE+'/r/'+token); await wait(c,2500);
await c.click('text=Receber meus pontos'); await c.waitForURL('**/carteira/*?credited=1');
assert.equal(sql(`select points from "Claim" where token='${token}'`), String(base));
console.log('5. cliente recente não ganha a campanha de quem sumiu OK');

// relatório
await o.goto(BASE+'/dashboard/pontos'); await wait(o,2500);
await o.waitForSelector('text=Campanhas no mês');
await o.waitForSelector('tr:has-text("Boas-vindas"):has-text("+100")');
await o.waitForSelector(`tr:has-text("Volta pra gente"):has-text("+${base}")`);
await o.screenshot({path:'relatorio-campanhas.png', fullPage:true});
console.log('6. relatório mensal por campanha OK');

// vazio com ilustração
await o.goto(BASE+'/dashboard/clientes?q=zzzz'); await wait(o,2000);
await o.waitForSelector('text=Nenhum cliente encontrado');
await o.screenshot({path:'vazio-clientes.png'});
sql('delete from "PromotionUse"'); sql('delete from "Promotion"');
await browser.close(); console.log('ALL OK (público e relatório)');
