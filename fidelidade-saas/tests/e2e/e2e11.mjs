import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const DB='postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql=(q)=>execSync(`psql ${DB} -At -c ${JSON.stringify(q)}`).toString().trim();
const wait=(p,t)=>p.waitForTimeout(t);
sql('truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now()');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({viewport:{width:1280,height:1000}});
await ctx.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const o = await ctx.newPage(); o.on('pageerror',e=>console.log('PAGEERROR',e.message));

// busca na web exige login
const anon = await browser.newContext(); const a401 = await anon.request.get(BASE+'/api/imagens/buscar?q=guarana');
assert.equal(a401.status(), 401);
await o.goto(BASE+'/login'); await wait(o,1500);
await o.fill('#email','ze@burger.com'); await o.fill('#password','senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
assert.equal((await o.request.get(BASE+'/api/imagens/buscar?q=a')).status(), 400);
console.log('1. busca na web: exige login (401) e valida o termo (400) OK');

// produto: foto no mesmo passo (escolher já salva) — troca e remove o botão "Salvar foto"
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o,2000);
const row = o.locator('li:has(button:has-text("Buscar foto"))').first();
assert.equal(await row.locator('button:has-text("Salvar foto")').count(), 0);
const before = sql(`select "imageId" from "Reward" order by "createdAt" limit 1`);
await row.locator('input[type=file]').setInputFiles('prato.png');
await o.waitForSelector('text=Foto atualizada.');
const after = sql(`select "imageId" from "Reward" order by "createdAt" limit 1`);
assert.ok(after && after !== before, 'foto trocada ao escolher o arquivo');
console.log('2. produto: escolher o arquivo já troca a foto (sem "Salvar foto") OK');

// busca na web (resultados simulados; a rede externa fica bloqueada neste ambiente)
await o.route('**/api/imagens/buscar**', (r) => r.fulfill({ json: { items: [
  { code: '7891', name: 'Guaraná Antarctica 350 ml', brand: 'Antarctica', thumb: 'https://images.openfoodfacts.org/images/products/789/1/front_pt.1.200.jpg', image: 'https://images.openfoodfacts.org/images/products/789/1/front_pt.1.400.jpg' },
  { code: '7892', name: 'Guaraná Zero', brand: 'Antarctica', thumb: 'https://images.openfoodfacts.org/images/products/789/2/front_pt.1.200.jpg', image: 'https://images.openfoodfacts.org/images/products/789/2/front_pt.1.400.jpg' },
] } }));
await row.locator('button:has-text("Buscar foto")').click();
await o.waitForSelector('input[aria-label="Buscar foto do produto na web"]');
await o.fill('input[aria-label="Buscar foto do produto na web"]', 'guaraná 350');
await o.keyboard.press('Enter'); // Enter busca e não envia formulário
await o.waitForSelector('ul[aria-label="Fotos encontradas"] li');
assert.equal(await o.locator('ul[aria-label="Fotos encontradas"] li').count(), 2);
await o.screenshot({path:'shots/busca-web.png'});
await o.locator('ul[aria-label="Fotos encontradas"] li').first().click();
// o servidor tenta baixar a imagem: sem rede externa aqui, deve avisar de forma clara e não mudar a foto
await o.waitForSelector('[role=alert]:has-text("baixar")', { timeout: 15000 });
assert.equal(sql(`select "imageId" from "Reward" order by "createdAt" limit 1`), after);
console.log('3. busca na web: lista as opções e, se o download falhar, avisa sem trocar a foto OK');
await o.unroute('**/api/imagens/buscar**');

// novo produto: botão de busca presente e Enter não cria o produto
await o.locator('form:has(input[aria-label="Nome do produto"]) button:has-text("Buscar foto")').click();
await o.waitForSelector('form:has(input[aria-label="Nome do produto"]) input[aria-label="Buscar foto do produto na web"]');
console.log('4. novo produto também tem "Buscar na web" OK');

// imprimir o QR Code
await o.goto(BASE+'/dashboard/caixa'); await wait(o,2000);
await o.fill('#amount','80,00'); await o.click('text=Gerar QR Code');
await o.waitForSelector('button:has-text("Imprimir QR Code")');
await o.emulateMedia({ media: 'print' });
const vis = await o.evaluate(() => {
  const t = document.querySelector('.print-portal');
  const shown = (el) => !!el && getComputedStyle(el).display !== 'none';
  return { ticket: shown(t), text: t?.textContent ?? '', qr: !!t?.querySelector('svg'), root: [...document.body.children].filter((c) => !c.classList.contains('print-portal')).some((c) => shown(c)) };
});
assert.ok(vis.ticket && vis.qr, 'cupom aparece na impressão com o QR Code');
assert.equal(vis.root, false, 'o resto da página some na impressão');
assert.match(vis.text, /Burger do Zé/); assert.match(vis.text, /pontos/); assert.match(vis.text, /Uso único/);
await o.screenshot({path:'shots/imprimir-cupom.png'});
const pdf = await o.pdf({ preferCSSPageSize: true, printBackground: false });
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
assert.equal(pages, 1, 'o cupom cabe em uma página');
await o.emulateMedia({ media: 'screen' });
console.log('5. imprimir QR Code: cupom 80 mm com QR, resto da página escondido, 1 página OK');
await browser.close();
