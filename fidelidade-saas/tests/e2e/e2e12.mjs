import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const DB='postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql=(q)=>execSync(`psql ${DB} -At -c ${JSON.stringify(q)}`).toString().trim();
const wait=(p,t)=>p.waitForTimeout(t);
sql('truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now()');
sql(`update "Restaurant" set category=null, "categoryOther"=null, listed=true where email='ze@burger.com'`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({viewport:{width:1280,height:1000}});
await ctx.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const o = await ctx.newPage(); o.on('pageerror',e=>console.log('PAGEERROR',e.message));
await o.goto(BASE+'/login'); await wait(o,1500);
await o.fill('#email','ze@burger.com'); await o.fill('#password','senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await wait(o,1500);

// 1. início do restaurante usa o gráfico de área padrão (linha), com dica imediata
assert.equal(await o.locator('svg[aria-label="Vendas lançadas por dia"] path[stroke="#2150C9"]').count(), 1, 'linha azul do gráfico de área');
const slot = o.locator('svg[aria-label="Vendas lançadas por dia"] rect[aria-label]:not([aria-label*="Sem vendas"])').last();
await slot.scrollIntoViewIfNeeded(); await slot.hover();
const tip = o.locator('[role=tooltip]'); await tip.waitFor({ timeout: 1000 });
const t1 = await tip.innerText(); assert.match(t1, /R\$\s?[\d.]+,\d\d/);
await o.screenshot({path:'shots/area-restaurante.png'});
console.log('1. início do restaurante: gráfico de área padrão com dica imediata OK ->', t1.replace(/\n+/g,' | '));

// 2. categorias novas na vitrine e "Todos" em cores neutras
const cc = await browser.newContext({viewport:{width:1280,height:1000}}); await cc.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const c = await cc.newPage(); c.on('pageerror',e=>console.log('PAGEERROR',e.message));
await c.goto(BASE+'/entrar'); await wait(c,1500);
await c.fill('#c-email','lucas@teste.com'); await c.fill('#c-password','senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await c.goto(BASE+'/lugares'); await wait(c,1800);
const fills = await c.locator('[aria-label="Categorias"] li:first-child svg rect').evaluateAll((els)=>els.slice(0,4).map((e)=>e.getAttribute('fill')));
for (const f of fills) assert.ok(['#8FA3C7','#C9D3E6'].includes(f), 'cor neutra no Todos: '+f);
await c.click('[aria-label="Categorias"] button:has-text("Todos")');
await c.waitForSelector('#todas-categorias');
for (const l of ['Estética e saúde','Pet shop','Farmácia','Serviços','Academia e fitness','Mercado e empório','Moda e acessórios','Outros']) await c.waitForSelector(`[aria-labelledby=todas-categorias] >> text=${l}`);
await c.screenshot({path:'shots/categorias-todas.png'});
console.log('2. "Todos" em cores neutras e categorias novas (estética, pet, farmácia, serviços, academia, mercado, moda) OK');
await c.keyboard.press('Escape'); await c.click('[aria-labelledby=todas-categorias] >> text=Fechar').catch(()=>{});

// 3. dono escolhe "Outros", descreve o negócio e vê o link do suporte
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o,2000);
await o.selectOption('#i-cat','outros');
await o.waitForSelector('#i-other');
await o.fill('#i-other','Doceria');
const sup = o.locator('form:has(#i-cat) p:has-text("Fale com o suporte")');
await sup.waitFor();
const mail = await sup.locator('a:has-text("E-mail")').getAttribute('href');
assert.match(mail, /^mailto:suporte@exemplo\.com\?subject=/, 'e-mail é o canal principal');
assert.match(decodeURIComponent(mail), /Doceria/);
const link = sup.locator('a:has-text("WhatsApp")');
await link.waitFor();
const href = await link.getAttribute('href');
assert.match(href, /^https:\/\/wa\.me\/5511975944834\?text=/);
assert.match(decodeURIComponent(href), /Burger do Zé/); assert.match(decodeURIComponent(href), /Doceria/);
await o.click('form:has(#i-cat) button[type=submit]'); await o.waitForSelector('text=Identidade da marca salva.');
assert.equal(sql(`select category||'|'||"categoryOther" from "Restaurant" where email='ze@burger.com'`), 'outros|Doceria');
console.log('3. dono: "Outros" + descrição salva e link do suporte com a mensagem pronta OK');

// 4. cliente acha pelo texto dentro de "Outros"
await c.goto(BASE+'/lugares'); await wait(c,1800);
await c.click('[aria-label="Categorias"] button:has-text("Todos")'); await c.waitForSelector('#todas-categorias');
await c.click('[aria-labelledby=todas-categorias] button:has-text("Outros")');
await c.waitForSelector('#outros-q');
await c.fill('#outros-q','doceria');
await c.waitForSelector('a:has-text("Burger do Zé")');
await c.screenshot({path:'shots/categoria-outros.png'});
await c.fill('#outros-q','chaveiro'); await c.waitForSelector('text=Nenhum lugar de Outros');
console.log('4. cliente: filtro "Outros" aceita texto e acha "Outros · Doceria" OK');

// 5. trocar para categoria fixa limpa o texto
await o.selectOption('#i-cat','estetica'); assert.equal(await o.locator('#i-other').count(), 0);
await o.click('form:has(#i-cat) button[type=submit]'); await o.waitForSelector('text=Identidade da marca salva.');
assert.equal(sql(`select category||'|'||coalesce("categoryOther",'-') from "Restaurant" where email='ze@burger.com'`), 'estetica|-');
sql(`update "Restaurant" set category='hamburguer' where email='ze@burger.com'`);
console.log('5. categoria fixa limpa o texto de "Outros" OK');
await browser.close();
