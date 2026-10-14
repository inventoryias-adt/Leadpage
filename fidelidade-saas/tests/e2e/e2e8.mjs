import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const sql=(q)=>execSync(`psql postgresql://postgres:postgres@localhost:5432/fidelidade -At -c ${JSON.stringify(q)}`).toString().trim();
sql('TRUNCATE "RateLimit"'); sql('update "Restaurant" set "guideDoneAt"=now()');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const wait=(p,t)=>p.waitForTimeout(t);
const octx = await browser.newContext({ viewport:{width:1366,height:900} });
await octx.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const o = await octx.newPage();
o.on('pageerror',e=>console.log('PAGEERROR',e.message));

// ---- audita campos: nada de histórico do navegador
async function audit(page, url, tag){
  await page.goto(BASE+url); await wait(page,2200);
  const bad = await page.evaluate(()=>[...document.querySelectorAll('input, textarea, select')].filter(el=>{
    if(['hidden','checkbox','radio','file','submit','button'].includes(el.type)) return false;
    if(el.type==='password') return false;
    const a=el.getAttribute('autocomplete'); return !(a==='off'||a==='username'||a==='current-password'||a==='new-password');
  }).map(el=>`${el.tagName}#${el.id||el.name}[${el.getAttribute('autocomplete')}]`));
  assert.deepEqual(bad,[],`${tag}: campos com histórico: ${bad.join(', ')}`);
}
await audit(o,'/','landing'); await audit(o,'/login','login'); await audit(o,'/entrar','entrar'); await audit(o,'/lugares','lugares');
console.log('0a. campos sem histórico (landing, login, entrar, lugares) OK');

await o.goto(BASE+'/login'); await wait(o,2500);
assert.equal(await o.getAttribute('#email','autocomplete'),'username');
await o.fill('#email','ze@burger.com'); await o.fill('#password','senha-segura-1');
await o.click('button:has-text("Entrar")'); await o.waitForURL('**/dashboard');
for (const [u,t] of [['/dashboard/caixa','caixa'],['/dashboard/clientes','clientes'],['/dashboard/configuracoes','config'],['/dashboard/resgates','resgates']]) await audit(o,u,t);
// campos que aparecem depois (janela do guia e formulário de unidade)
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o,2200);
await o.click('summary:has-text("Adicionar outra unidade")'); await wait(o,500);
const bad2 = await o.evaluate(()=>[...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select')].filter(el=>el.getAttribute('autocomplete')!=='off'&&el.getAttribute('autocomplete')!=='username'&&el.type!=='password').map(el=>el.id||el.name));
assert.deepEqual(bad2,[]);
console.log('0b. campos do painel, inclusive os que abrem depois, sem histórico OK');

// ---- painel
// quem sumiu: última compra há 40 dias
sql(`update "Claim" set "redeemedAt"=now()-interval '40 days' where "customerId"=(select id from "Customer" where cpf='52998224725') and "redeemedAt" is not null`);
await o.goto(BASE+'/dashboard'); await wait(o,2500);
await o.waitForSelector('h1:has-text("Painel")');
await o.waitForSelector('text=Vendas lançadas'); await o.waitForSelector('text=Ticket médio'); await o.waitForSelector('text=Taxa de retorno'); await o.waitForSelector('text=Pontos em circulação');
await o.locator('[aria-label="Vendas lançadas por dia"]').or(o.getByText('Sem compras neste período')).first().waitFor();
await o.waitForSelector('[aria-label^="Compras por dia da semana"]');
await o.waitForSelector('text=Ideias para vender mais');
await o.waitForSelector('text=Para reconquistar');
const wa = await o.locator('a:has-text("Chamar")').first().getAttribute('href');
assert.match(wa,/^https:\/\/wa\.me\/55\d{10,11}\?text=/);
await o.screenshot({path:'painel-desk.png', fullPage:true});
console.log('1. painel com KPIs, gráficos, mapa de horários, ideias e reconquista OK');
await o.click('nav[aria-label="Período"] >> text=7 dias'); await o.waitForURL('**/dashboard?dias=7');
await o.waitForSelector('text=nos últimos 7 dias'); 
await o.click('nav[aria-label="Período"] >> text=90 dias'); await o.waitForURL('**/dashboard?dias=90');
console.log('2. seletor de período OK');

// ---- clientes por grupo
await o.goto(BASE+'/dashboard/clientes?seg=sumidos'); await wait(o,2000);
await o.waitForSelector('text=Lucas Silva');
assert.match(await o.locator('nav[aria-label="Segmentos"]').innerText(), /Sumidos\s*[1-9]/);
await o.goto(BASE+'/dashboard/clientes?seg=fieis&q=zzzz'); await wait(o,1500);
await o.waitForSelector('text=Nenhum cliente encontrado');
assert.equal(await o.getAttribute('nav[aria-label="Segmentos"] a[aria-current="true"]','href'),'/dashboard/clientes?seg=fieis');
console.log('3. grupos de clientes (sumidos e filtro dentro do grupo) OK');

// ---- planilhas
for (const [tipo,head] of [['clientes','Nome;CPF;Telefone'],['lancamentos','Data;Cliente;Valor da compra']]) {
  const res = await o.request.get(`${BASE}/dashboard/exportar/${tipo}`);
  assert.equal(res.status(),200);
  assert.match(res.headers()['content-type'],/text\/csv/);
  assert.match(res.headers()['content-disposition'],new RegExp(`attachment; filename="${tipo}-`));
  const body = await res.text();
  assert.ok(body.replace(/^﻿/,'').startsWith(head), body.slice(0,80));
  assert.ok(body.split('\r\n').length>2);
  if(tipo==='clientes') assert.ok(!/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(body),'CPF completo vazou na planilha');
}
assert.equal((await o.request.get(`${BASE}/dashboard/exportar/segredo`)).status(),404);
const anon = await browser.newContext(); 
const r0 = await anon.request.get(`${BASE}/dashboard/exportar/clientes`, { maxRedirects:0 });
assert.ok([302,303,307,308].includes(r0.status()), `sem login deveria redirecionar, veio ${r0.status()}`);
console.log('4. planilhas CSV (clientes e lançamentos), CPF mascarado, acesso só logado OK');

// ---- celular
const mctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true });
await mctx.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const m = await mctx.newPage();
await m.goto(BASE+'/login'); await wait(m,2500);
await m.fill('#email','ze@burger.com'); await m.fill('#password','senha-segura-1');
await m.click('button:has-text("Entrar")'); await m.waitForURL('**/dashboard'); await wait(m,2000);
const w = await m.evaluate(()=>[document.documentElement.scrollWidth, innerWidth]);
assert.ok(w[0]<=w[1], `rolagem lateral no painel (celular): ${w}`);
await m.screenshot({path:'painel-mob.png', fullPage:true});
console.log('5. painel no celular sem rolagem lateral OK');
await browser.close(); console.log('ALL OK (painel, grupos, planilhas e campos)');
