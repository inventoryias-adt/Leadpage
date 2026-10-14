import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000';
const sql = (q) => execSync(`psql postgresql://postgres:postgres@localhost:5432/fidelidade -At -c ${JSON.stringify(q)}`).toString().trim();
sql('TRUNCATE "RateLimit"');
const restaurantId = sql('select id from "Restaurant" limit 1');
assert.ok(restaurantId, 'rode o e2e.mjs antes (cria o restaurante e o cliente Lucas)');

const SE = { latitude: -23.5505, longitude: -46.6333 }; // restaurante
const NEAR = { latitude: -23.5506, longitude: -46.6334 }; // ~15 m
const FAR = { latitude: -23.4500, longitude: -46.5000 }; // ~17 km

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = (geo, mobile = true) =>
  browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, deviceScaleFactor: 2, geolocation: geo, permissions: ['geolocation'] });
const shot = (p, n) => p.screenshot({ path: `${n}.png`, fullPage: true });
const wait = (p, t) => p.waitForTimeout(t);

// ---------------------------------------------------------------- dono
const octx = await ctx(SE, false);
const o = await octx.newPage();
o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await wait(o, 2500);
await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1');
await o.click('button[type=submit]:has-text("Entrar")'); await o.waitForURL('**/dashboard');
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o, 2500);

// identidade: logo + categoria + Instagram
await o.selectOption('#i-cat', 'hamburguer');
await o.fill('#i-ig', '@burgerdoze');
await o.setInputFiles('form:has(#i-cat) input[type=file] >> nth=0', 'logo.png');
await o.waitForSelector('form:has(#i-cat) >> text=Trocar foto');
await o.click('button:has-text("Salvar identidade")');
await o.waitForSelector('text=Identidade da marca salva.');
// unidade: link do Google (inválido é recusado) + localização por GPS
const U = 'form:has(input[name=id])';
await o.fill(`${U} input[name=googleReviewUrl]`, 'https://site-qualquer.com/x');
await o.click('button:has-text("Salvar unidade")');
await o.waitForSelector('text=Link do Google inválido');
await o.fill(`${U} input[name=googleReviewUrl]`, 'https://g.page/r/CdemoBurgerDoZe/review');
await o.click(`${U} >> text=Estou na unidade (GPS)`);
await o.waitForSelector(`${U} >> text=Arraste o mapa`);
await o.click('button:has-text("Salvar unidade")');
await o.waitForSelector('text=Unidade salva.');
const r1 = sql(`select u."googleReviewUrl", u.latitude, r.category, r.instagram, r."logoImageId" is not null from "Unit" u join "Restaurant" r on r.id=u."restaurantId"`);
assert.match(r1, /https:\/\/g\.page\/r\/CdemoBurgerDoZe\/review\|-23\.55\d*\|hamburguer\|burgerdoze\|t/);
console.log('1. identidade (logo, localização, Google, Instagram) OK');

// engajamento e desafio
await o.fill('#e-ci', '5'); await o.fill('#e-rf', '100');
await o.click('form:has(#e-ci) button[type=submit]'); await o.waitForSelector('form:has(#e-ci) >> text=Salvo.');
await o.selectOption('#c-kind', 'PURCHASES'); await o.selectOption('#c-period', 'WEEK');
await o.fill('#c-target', '2'); await o.fill('#c-bonus', '200'); await o.fill('#c-min', '42,00');
await o.click('button:has-text("Criar desafio")');
await o.waitForSelector('li:has-text("Compre acima de")');
// foto do prêmio
await o.setInputFiles('li:has(button:has-text("Buscar foto")) input[type=file] >> nth=0', 'prato.png');
await o.waitForSelector('text=Foto atualizada.'); // escolher o arquivo já salva, sem segundo botão
await shot(o, 'cfg-identidade');
const imgId = sql(`select "imageId" from "Reward" where "imageId" is not null limit 1`);
assert.ok(imgId);
const imgRes = await o.request.get(`${BASE}/api/imagem/${imgId}`);
assert.equal(imgRes.status(), 200);
assert.match(imgRes.headers()['content-type'], /^image\//);
assert.equal(sql('select count(*) from "Challenge"'), '1');
console.log('2. check-in/indicação, desafio e foto de prêmio OK');

// ---------------------------------------------------------------- cliente Lucas (perto do lugar)
async function login(page, cpf, phone) {
  await page.goto(BASE + '/entrar'); await wait(page, 2500);
  await page.fill('#c-email', { '529.982.247-25': 'lucas@teste.com', '111.444.777-35': 'maria@teste.com' }[cpf]); await page.fill('#c-password', 'senha-cliente-1');
  await page.click('button[type=submit]:has-text("Entrar")'); await page.waitForURL('**/carteira');
}
const lctx = await ctx(NEAR);
const l = await lctx.newPage();
l.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await login(l, '529.982.247-25', '11999998888');
await l.waitForSelector('text=Cada compra vira pontos'); // apresentação
await l.click('text=Próximo'); await l.click('text=Próximo'); await l.click('button:has-text("Começar")');
await l.waitForSelector('text=Pode resgatar'); // selo no cartão do lugar
await shot(l, 'cli-inicio');

await l.goto(BASE + '/lugares'); await wait(l, 2500);
// permissão já concedida: a localização é usada sozinha, sem botão
await l.waitForSelector('a[href^="/lugar/"]:has-text("Burger do Zé") span.shrink-0.text-electric-600');
await l.waitForSelector('li:has-text("Burger do Zé") >> text=/\\d+ m$/');
await shot(l, 'cli-lugares');
await l.click('button:has-text("Buscar lugar ou categoria")'); // a busca abre em tela própria
await l.fill('[role=dialog] input[aria-label="Buscar lugares"]', 'zzzz');
await l.waitForSelector('text=Nada encontrado');
await l.fill('[role=dialog] input[aria-label="Buscar lugares"]', 'burger');
await l.click('[role=dialog] li:has-text("Burger do Zé") a');
await l.waitForURL('**/lugar/*');
await l.waitForSelector('text=Ações para ganhar pontos');
await l.waitForSelector('text=Faça check-in 1 vez').catch(() => {});
await l.waitForSelector('text=Compre acima de');
await l.waitForSelector('text=Avaliar no Google');
await l.waitForSelector('text=Indique amigos');
await shot(l, 'cli-lugar');
const placeUrl = l.url();

// check-in perto: ok, 2º no dia: recusado
await l.click('button:has-text("Fazer check-in")');
await l.waitForSelector('text=Check-in feito! +5 pontos');
await l.click('button:has-text("Fazer check-in")');
await l.waitForSelector('text=já fez check-in aqui hoje');
assert.equal(sql('select count(*) from "CheckIn"'), '1');
// check-in longe: recusado
const fctx = await ctx(FAR);
const f = await fctx.newPage();
await login(f, '529.982.247-25', '11999998888');
await f.goto(placeUrl); await wait(f, 2500);
await f.click('button:has-text("Fazer check-in")');
await f.waitForSelector('text=Chegue mais perto');
assert.equal(sql('select count(*) from "CheckIn"'), '1');
await fctx.close();
console.log('3. lugares perto + página do lugar + check-in por GPS OK');

// ---------------------------------------------------------------- desafio: 2 compras ≥ R$ 42 na semana
async function newClaim(amount) {
  await o.goto(BASE + '/dashboard/caixa'); await wait(o, 2500);
  await o.fill('#amount', amount);
  await o.click('text=Gerar QR Code'); await o.waitForSelector('text=Enviar por WhatsApp');
  return sql('select token from "Claim" order by "createdAt" desc limit 1');
}
async function claim(page, token) {
  await page.goto(`${BASE}/r/${token}`); await wait(page, 2000);
  await page.click('button:has-text("Receber meus pontos")');
  await page.waitForURL('**/carteira/*?credited=1');
}
const before = sql(`select count(*) from "Transaction" where description like 'Desafio concluído%'`);
await claim(l, await newClaim('50,00'));
await claim(l, await newClaim('60,00'));
await claim(l, await newClaim('70,00'));
assert.equal(sql(`select count(*) from "Transaction" where description like 'Desafio concluído%'`), String(Number(before) + 1), 'desafio premia uma única vez por período');
assert.equal(sql('select count(*) from "ChallengeCompletion"'), '1');
await l.goto(placeUrl); await wait(l, 1500);
await l.waitForSelector('text=Desafio concluído nesta semana');
console.log('4. desafio da casa (bônus único por período) OK');

// ---------------------------------------------------------------- indicação
const code = sql(`select "referralCode" from "Customer" where cpf='52998224725'`);
assert.match(code, /^[A-Z0-9]{8}$/);
const mctx = await ctx(NEAR);
const m = await mctx.newPage();
m.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await m.goto(`${BASE}/convite/${restaurantId}/${code}`); await wait(m, 2500);
await m.waitForSelector('text=Lucas te convidou!');
await m.fill('#s-name', 'Maria Souza'); await m.fill('#s-cpf', '111.444.777-35'); await m.fill('#s-phone', '11988887777'); await m.fill('#s-email', 'maria@teste.com'); await m.fill('#s-password', 'senha-cliente-1');
await m.click('button:has-text("Criar minha conta e entrar no clube")');
await m.waitForURL('**/lugar/*?bemvindo=1');
await m.waitForSelector('text=Conta criada!');
assert.equal(sql(`select status from "Referral"`), 'PENDING');
const lucasBefore = Number(sql(`select balance from "Wallet" w join "Customer" c on c.id=w."customerId" where c.cpf='52998224725'`));
await claim(m, await newClaim('80,00'));
assert.equal(sql(`select status from "Referral"`), 'REWARDED');
const lucasAfter = Number(sql(`select balance from "Wallet" w join "Customer" c on c.id=w."customerId" where c.cpf='52998224725'`));
assert.equal(lucasAfter - lucasBefore, 100);
assert.equal(sql(`select count(*) from "Transaction" where description like 'Indicação:%'`), '1');
await claim(m, await newClaim('90,00')); // segunda compra do amigo não premia de novo
assert.equal(sql(`select count(*) from "Transaction" where description like 'Indicação:%'`), '1');
// quem já é cliente não gera indicação
await mctx.close();
console.log('5. indicação de amigos (prêmio só na 1ª compra) OK');

// ---------------------------------------------------------------- sacola de prêmios
await l.goto(`${placeUrl}/premios`); await wait(l, 2500);
const bal = Number(sql(`select balance from "Wallet" w join "Customer" c on c.id=w."customerId" where c.cpf='52998224725'`));
await l.click('button[aria-label="Adicionar Sobremesa grátis à sacola"]');
await l.click('button[aria-label="Adicionar mais um Sobremesa grátis"]');
await l.click('button[aria-label="Adicionar Combo Hambúrguer + Fritas à sacola"]');
await l.waitForSelector('text=Sua sacola · 3 itens');
await shot(l, 'cli-sacola');
await l.click('button:has-text("Resgatar sacola")');
await l.click('button:has-text("Confirmar (")');
await l.waitForSelector('text=Resgate realizado!');
assert.equal(await l.locator('.font-mono').count(), 3);
assert.equal(Number(sql(`select balance from "Wallet" w join "Customer" c on c.id=w."customerId" where c.cpf='52998224725'`)), bal - 2200);
await shot(l, 'cli-resgatado');
assert.equal(sql(`select count(*) from "Redemption" r join "Customer" c on c.id=r."customerId" where c.cpf='52998224725' and r.status='PENDING'`), '3');
// limite mensal (5): já usou 1 + 3 = 4; só cabe mais 1
await l.goto(`${placeUrl}/premios`); await wait(l, 2000);
await l.click('button[aria-label="Adicionar Sobremesa grátis à sacola"]');
assert.equal(await l.locator('button[aria-label="Adicionar mais um Sobremesa grátis"]').isDisabled(), true);
console.log('6. sacola de prêmios (vários itens, saldo e limite) OK');

// ---------------------------------------------------------------- perfil e início
await l.goto(BASE + '/perfil'); await wait(l, 1500);
await l.waitForSelector('text=Indique amigos');
await l.waitForSelector('text=Histórico de pontos');
await shot(l, 'cli-perfil');
await l.goto(BASE + '/perfil/pontos'); await wait(l, 1000); // o histórico agora é uma tela à parte
await l.waitForSelector('text=Check-in no local');
await l.goto(BASE + '/carteira'); await wait(l, 1500);
await l.waitForSelector('text=para retirar'); // selo no cartão do lugar
await shot(l, 'cli-inicio2');

// ---------------------------------------------------------------- vitrine respeita "listed" e assinatura
sql(`update "Restaurant" set listed=false`);
await l.goto(BASE + '/lugares'); await wait(l, 1500);
await l.waitForSelector('text=Nada encontrado');
sql(`update "Restaurant" set listed=true`);
console.log('7. perfil, início e vitrine OK');

await browser.close();
console.log('ALL OK (novo)');
