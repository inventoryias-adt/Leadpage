// Perfil personalizado do lugar: o dono escolhe a cor da marca, o slogan e o "sobre nós"; a página do lugar no app do cliente usa a cor
// (botão principal e capa sem foto), mostra o slogan e o texto; cor fora da lista é recusada; sem escolha vale o marinho padrão.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`truncate "RateLimit"; update "Restaurant" set "brandColor"=null, tagline=null, about=null, "coverImageId"=null, "subscriptionStatus"='ACTIVE', "onboardedAt"=coalesce("onboardedAt",now()), listed=true where id='${rid}'`);

// o botão principal ("Fazer pedido") só aparece com pedidos ligados e algo no cardápio
const ordersBefore = sql(`select "ordersEnabled"::text from "Restaurant" where id='${rid}'`);
sql(`update "Restaurant" set "ordersEnabled"=true where id='${rid}'; delete from "MenuItem" where name='Item teste marca'; insert into "MenuItem"(id,"restaurantId",name,"priceCents",active) values (gen_random_uuid()::text,'${rid}','Item teste marca',1500,true)`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (w, h) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return p;
};
const O = await mk(1100, 1000);
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
const C = await mk(390, 844);
await C.goto(BASE + '/entrar'); await C.fill('#c-email', 'lucas@teste.com'); await C.fill('#c-password', 'senha-cliente-1'); await C.click('button[type=submit]'); await C.waitForURL('**/carteira**');
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };

// 1. sem personalização: marinho padrão, sem slogan nem "sobre nós"
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('main.brand-scope');
const btn = C.locator('main.brand-scope .glass-button-navy').first();
await btn.waitFor();
assert.equal(await btn.evaluate((e) => getComputedStyle(e).backgroundColor), rgb('#0F1F3D'));
assert.equal(await C.locator('[data-testid=place-tagline]').count(), 0);
assert.equal(await C.locator('[data-testid=place-about]').count(), 0);
console.log('1. sem personalização: marinho padrão, sem slogan nem sobre nós OK');

// 2. o dono escolhe cor, slogan e sobre nós e salva; a prévia acompanha a cor
await O.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await O.waitForSelector('[data-testid=brand-fields]');
// a escolha é um campo controlado pelo React: antes de a tela "acordar" (hidratar) o clique não pega; tenta de novo até marcar
for (let i = 0; i < 12 && !(await O.locator('[data-testid=brand-vinho]').isChecked()); i++) { await O.locator('[data-testid=brand-vinho]').check({ force: true, timeout: 3000 }).catch(() => {}); await O.waitForTimeout(400); }
assert.equal(await O.locator('[data-testid=brand-preview] span.inline-flex').evaluate((e) => getComputedStyle(e).backgroundColor), rgb('#9F1239'));
await O.fill('[data-testid=brand-tagline]', '  O melhor   burger da Vila  ');
await O.fill('[data-testid=brand-about]', 'Desde 2015 na esquina.\n\n\n\nCarne moída na hora.');
await O.click('button:has-text("Salvar identidade")'); await O.waitForSelector('text=Identidade da marca salva');
assert.equal(sql(`select coalesce("brandColor",'-')||'|'||coalesce(tagline,'-')||'|'||coalesce(about,'-') from "Restaurant" where id='${rid}'`), 'vinho|O melhor burger da Vila|Desde 2015 na esquina.\n\nCarne moída na hora.');
console.log('2. dono salva cor, slogan e sobre nós (espaços e linhas em branco arrumados) OK');

// 3. o cliente vê a cor nos botões e na capa sem foto, o slogan e o texto
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=place-tagline]');
assert.equal(await C.locator('[data-testid=place-tagline]').innerText(), 'O melhor burger da Vila');
assert.match(await C.locator('[data-testid=place-about]').innerText(), /Desde 2015 na esquina\.[\s\S]*Carne moída na hora\./);
assert.equal(await C.locator('main.brand-scope .glass-button-navy').first().evaluate((e) => getComputedStyle(e).backgroundColor), rgb('#9F1239'));
assert.match(await C.locator('main.brand-scope div.h-44 > div').first().evaluate((e) => e.getAttribute('style') ?? ''), /159, 18, 57|#9F1239/i);
assert.ok(await C.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sem rolagem lateral');
console.log('3. cliente vê a cor da marca nos botões e na capa, o slogan e o sobre nós OK');

// 4. o dono volta ao marinho (guarda nada) e limpa os textos
await O.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await O.waitForSelector('[data-testid=brand-fields]');
assert.equal(await O.locator('[data-testid=brand-vinho]').isChecked(), true, 'o formulário volta marcado na cor salva');
await O.locator('[data-testid=brand-marinho]').check({ force: true });
await O.fill('[data-testid=brand-tagline]', ''); await O.fill('[data-testid=brand-about]', '');
await O.click('button:has-text("Salvar identidade")'); await O.waitForSelector('text=Identidade da marca salva');
assert.equal(sql(`select coalesce("brandColor",'-')||'|'||coalesce(tagline,'-')||'|'||coalesce(about,'-') from "Restaurant" where id='${rid}'`), '-|-|-');
console.log('4. voltar ao marinho e limpar os textos OK');

// 5. o servidor recusa cor fora da lista e textos grandes demais (mesmo que a tela seja burlada)
await O.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await O.waitForSelector('[data-testid=brand-fields]');
await O.locator('[data-testid=brand-azul]').check({ force: true });
await O.evaluate(() => { document.querySelector('[data-testid=brand-azul]').value = 'fucsia'; }); // depois de marcar, para o React não devolver o valor
await O.click('button:has-text("Salvar identidade")'); await O.waitForSelector('text=Escolha uma das cores da lista');
assert.equal(sql(`select coalesce("brandColor",'-') from "Restaurant" where id='${rid}'`), '-');
console.log('5. cor fora da lista é recusada pelo servidor OK');

sql(`update "Restaurant" set "brandColor"=null, tagline=null, about=null, "ordersEnabled"=${ordersBefore === 't'} where id='${rid}'; delete from "MenuItem" where name='Item teste marca'`);
await b.close();
