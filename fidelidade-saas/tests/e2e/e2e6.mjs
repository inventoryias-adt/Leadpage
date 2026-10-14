import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const sql=(q)=>execSync(`psql postgresql://postgres:postgres@localhost:5432/fidelidade -At -c ${JSON.stringify(q)}`).toString().trim();
sql('TRUNCATE "RateLimit"'); sql('delete from "Promotion"'); sql('update "Restaurant" set "guideDoneAt"=now()');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const octx = await browser.newContext({ viewport:{width:1280,height:900} });
const o = await octx.newPage();
o.on('pageerror',e=>console.log('PAGEERROR',e.message));
const wait=(p,t)=>p.waitForTimeout(t);
await o.goto(BASE+'/login'); await wait(o,2500);
await o.fill('#email','ze@burger.com'); await o.fill('#password','senha-segura-1');
await o.click('button:has-text("Entrar")'); await o.waitForURL('**/dashboard');

// ---------- campanha 2x
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o,2500);
await o.fill('#p-title','Teste em dobro');
await o.click('button:has-text("Criar campanha")');
await o.waitForSelector('text=Campanha criada.');
await o.waitForSelector('li:has-text("Teste em dobro"):has-text("Valendo agora")');
assert.equal(sql(`select kind||'|'||multiplier from "Promotion" where title='Teste em dobro'`),'MULTIPLIER|2');
await o.screenshot({path:'promo-config.png', fullPage:true});
console.log('1. campanha 2x criada e valendo agora OK');

// ---------- caixa aplica a campanha (prévia e servidor)
const ppr = Number(sql('select "pointsPerReal" from "Restaurant" limit 1'));
await o.goto(BASE+'/dashboard/caixa'); await wait(o,2500);
await o.waitForSelector('text=Campanha valendo agora');
await o.fill('#amount','100,00');
const expected = 100*ppr*2;
await o.waitForSelector(`text=/${String(expected).replace(/(\d)(?=(\d{3})+$)/g,'$1.')} pts/`);
await o.click('text=Gerar QR Code'); await o.waitForSelector('text=Enviar por WhatsApp');
let row = sql(`select points||'|'||description from "Claim" order by "createdAt" desc limit 1`);
console.log(row);
assert.ok(row.startsWith(`${expected}|`) && row.includes('2x pontos · Teste em dobro'));
console.log('2. caixa aplica o 2x (prévia e servidor) OK');

// ---------- pontos extras com mínimo; multiplicador não soma com outro multiplicador
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o,2500);
await o.fill('#p-title','Bonus acima de 40');
await o.selectOption('#p-kind','BONUS');
await o.fill('#p-bonus','50'); await o.fill('#p-min','40,00');
await o.click('button:has-text("Criar campanha")');
await o.waitForSelector('li:has-text("Bonus acima de 40"):has-text("+50 pontos")');
await o.goto(BASE+'/dashboard/caixa'); await wait(o,2500);
await o.fill('#amount','100,00');
await o.waitForSelector(`text=/${String(expected+50).replace(/(\d)(?=(\d{3})+$)/g,'$1.')} pts/`);
await o.fill('#amount','30,00'); // abaixo do mínimo: só o 2x
await o.waitForSelector(`text=/${String(30*ppr*2).replace(/(\d)(?=(\d{3})+$)/g,'$1.')} pts/`);
console.log('3. pontos extras com valor mínimo OK');

// ---------- cliente vê o card e a seção
const cctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true });
await cctx.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const c = await cctx.newPage();
await c.goto(BASE+'/lugares'); await wait(c,2500);
await c.waitForSelector('section[aria-labelledby=campanhas] button:has-text("campanha")');
await c.screenshot({path:'promo-cliente.png'});
await c.click('section[aria-labelledby=campanhas] button:has-text("campanha")');
await c.waitForSelector('[role=dialog]:has-text("Teste em dobro")');
assert.match(await c.locator('[role=dialog]').innerText(), /2x pontos/);
console.log('4. card da campanha na vitrine OK');
const rid = sql('select id from "Restaurant" limit 1');
await c.goto(BASE+'/lugar/'+rid); await wait(c,2000);
await c.waitForSelector('text=Campanhas de pontos');
await c.waitForSelector('text=Valendo agora');
console.log('5. seção de campanhas na página do lugar OK');

// ---------- pausar tira do caixa e da vitrine
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o,2500);
for (const t of ['Teste em dobro','Bonus acima de 40']) {
  await o.click(`li:has-text("${t}") >> button:has-text("Pausar")`); await wait(o,800);
}
await o.waitForSelector('li:has-text("Teste em dobro"):has-text("Pausada")');
await c.goto(BASE+'/lugares'); await wait(c,2000);
await c.click('section[aria-labelledby=campanhas] button:has-text("campanha")'); await c.waitForSelector('[role=dialog]'); assert.doesNotMatch(await c.locator('[role=dialog]').innerText(), /Teste em dobro/);
console.log('6. campanha pausada some da vitrine OK');

// ---------- guia reaberto pelo botão
await o.goto(BASE+'/dashboard'); await wait(o,2500);
await o.click('button:has-text("Guia")');
await o.waitForSelector('[role=dialog]');
for (let i=0;i<7;i++) await o.click('[role=dialog] >> text=Próximo');
await o.waitForSelector('[role=dialog]:has-text("Como o cliente entra")');
assert.match(await o.locator('[role=dialog]').innerText(), /\/entrar/);
await o.screenshot({path:'guia-cliente.png'});
await o.keyboard.press('Escape');
await o.waitForSelector('[role=dialog]',{state:'detached'});
console.log('7. guia reaberto pelo botão, link do cliente e Esc OK');

sql('delete from "Promotion"');
await browser.close(); console.log('ALL OK (campanhas do dono + guia)');
