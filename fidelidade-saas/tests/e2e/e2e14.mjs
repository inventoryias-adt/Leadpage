import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const DB='postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql=(q)=>execFileSync('psql',[DB,'-At','-c',q]).toString().trim();
const wait=(p,t)=>p.waitForTimeout(t);
sql('truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now()');
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const rewardId = sql(`select id from "Reward" where name='Sobremesa grátis' and active order by "createdAt" limit 1`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({viewport:{width:1280,height:1000}});
await ctx.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const o = await ctx.newPage(); o.on('pageerror',e=>console.log('PAGEERROR',e.message));
await o.goto(BASE+'/login'); await wait(o,1500);
await o.fill('#email','ze@burger.com'); await o.fill('#password','senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');

// 1. editar produto: pontos e valor em R$
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o,2000);
const row = o.locator(`li:has(form:has(input[name=id][value="${rewardId}"]))`).first();
await row.locator('button:has-text("Editar")').click();
const form = row.locator('form:has(input[name=pointsCost])');
await form.locator('input[name=cashValue]').fill('abc'); await form.locator('button:has-text("Salvar alterações")').click();
await o.waitForSelector('text=Valor em R$ inválido');
await form.locator('input[name=pointsCost]').fill('300'); await form.locator('input[name=cashValue]').fill('8,00');
await form.locator('button:has-text("Salvar alterações")').click();
await o.waitForSelector(`li:has-text("Sobremesa grátis") >> text=/R\\$\\s*8,00 \\+ 300 pts/`);
assert.equal(sql(`select "pointsCost"||'|'||"cashCents" from "Reward" where id='${rewardId}'`), '300|800');
console.log('1. editar produto: pontos e valor em R$ (com validação) OK');

sql(`update "Redemption" set "createdAt"=now()-interval '40 days' where "customerId"=(select id from "Customer" where email='lucas@teste.com')`);
sql(`update "Wallet" set balance=2000 where "customerId"=(select id from "Customer" where email='lucas@teste.com') and "restaurantId"='${rid}'`);
// 2. cliente vê "R$ + pontos", resgata, o voucher manda pagar e o dono vê quanto cobrar
const cc = await browser.newContext({viewport:{width:1280,height:1000}}); await cc.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const c = await cc.newPage(); c.on('pageerror',e=>console.log('PAGEERROR',e.message));
await c.goto(BASE+'/entrar'); await wait(c,1500);
await c.fill('#c-email','lucas@teste.com'); await c.fill('#c-password','senha-cliente-1'); await c.click('button[type=submit]:has-text("Entrar")'); await c.waitForURL('**/carteira**');
await c.goto(`${BASE}/lugar/${rid}/premios`); await wait(c,2000);
await c.waitForSelector('text=/R\\$\\s*8,00 \\+ 300 pts/');
await c.waitForSelector('text=R$ + pontos');
await c.click('button[aria-label="Adicionar Sobremesa grátis à sacola"]');
await c.click('button:has-text("Resgatar sacola")'); await c.click('button:has-text("Confirmar (")');
await c.waitForSelector('text=Resgate realizado!');
assert.equal(sql(`select "cashCents" from "Redemption" where "rewardId"='${rewardId}' order by "createdAt" desc limit 1`), '800');
await c.goto(`${BASE}/carteira/${rid}`); await wait(c,1800);
await c.waitForSelector('text=/pague R\\$\\s*8,00/');
await o.goto(BASE+'/dashboard/resgates'); await wait(o,1800);
await o.waitForSelector('text=/Cobrar R\\$\\s*8,00 no balcão/');
console.log('3. resgate com valor: cliente vê o preço misto, o voucher manda pagar e o dono vê quanto cobrar OK');
// volta ao preço original
sql(`update "Reward" set "pointsCost"=500, "cashCents"=0 where id='${rewardId}'`);

// 4. página inicial: "Começar agora" leva ao cadastro, foca e pisca
const lp = await browser.newContext({viewport:{width:1280,height:900}}); await lp.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const l = await lp.newPage(); l.on('pageerror',e=>console.log('PAGEERROR',e.message));
await l.goto(BASE+'/'); await wait(l,2000);
await l.click('a:has-text("Começar agora")'); await wait(l,1400);
assert.equal(await l.evaluate(()=>document.activeElement?.id), 'name', 'foca o nome do estabelecimento');
assert.equal(await l.evaluate(()=>document.getElementById('name').classList.contains('pulse-attention') && document.getElementById('assinar').classList.contains('pulse-attention')), true, 'campo e cartão piscam');
await l.screenshot({path:'shots/landing-pisca.png'});
await wait(l,4200);
assert.equal(await l.evaluate(()=>document.getElementById('name').classList.contains('pulse-attention')), false, 'para de piscar');
await l.evaluate(()=>window.scrollTo(0, document.body.scrollHeight)); await wait(l,400);
await l.click('a:has-text("Quero fidelizar meus clientes")'); await wait(l,1400);
assert.equal(await l.evaluate(()=>document.activeElement?.id), 'name');
assert.equal(await l.evaluate(()=>document.getElementById('name').classList.contains('pulse-attention')), true);
console.log('4. landing: os dois botões levam ao cadastro, focam o 1º campo e fazem piscar OK');
await l.evaluate(()=>window.scrollTo(0,0)); await l.click('text=Como funciona'); 
await l.screenshot({path:'shots/landing-passos.png', fullPage:false});

// 5. cupom impresso: nome, data, valor e centralizado
await o.goto(BASE+'/dashboard/caixa'); await wait(o,2000);
await o.fill('#amount','80,00'); await o.fill('#print-name','Maria Souza'); await o.click('text=Gerar QR Code');
await o.waitForSelector('button:has-text("Imprimir QR Code")');
await o.emulateMedia({ media: 'print' });
const t = await o.evaluate(() => {
  const box = document.querySelector('.print-portal .pt-box'); const r = box.getBoundingClientRect();
  return { text: box.textContent, cx: (r.left + r.right) / 2 / innerWidth, cy: (r.top + r.bottom) / 2 / innerHeight };
});
assert.match(t.text, /Cliente\s*Maria Souza/); assert.match(t.text, /Data\s*\d\d\/\d\d\/\d{4}/); assert.match(t.text, /Valor da compra\s*R\$\s*80,00/);
assert.ok(Math.abs(t.cx - 0.5) < 0.03, 'centralizado na horizontal: '+t.cx); assert.ok(Math.abs(t.cy - 0.5) < 0.08, 'centralizado na vertical: '+t.cy);
await o.screenshot({path:'shots/cupom-centro.png'});
await o.emulateMedia({ media: 'screen' });
console.log('5. cupom: nome, data e valor da compra, centralizado na página OK');

// 6. portal da assinatura: erro vira mensagem, não tela de erro
const old = sql(`select coalesce("paymentCustomerId",'') from "Restaurant" where id='${rid}'`);
sql(`update "Restaurant" set "paymentCustomerId"='cus_inexistente' where id='${rid}'`);
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o,2000);
await o.click('button:has-text("Gerenciar assinatura e faturas")');
await o.waitForSelector('[role=alert]:has-text("cobrança ativa")');
assert.equal(await o.locator('text=Application error').count(), 0);
sql(`update "Restaurant" set "paymentCustomerId"=${old ? `'${old}'` : 'null'} where id='${rid}'`);
console.log('6. gerenciar assinatura: falha mostra aviso claro em vez da tela de erro OK');
await browser.close();
