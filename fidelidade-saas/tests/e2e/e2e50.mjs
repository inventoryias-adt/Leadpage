import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now()`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');

// 1. abre na etapa 1 e só ela aparece
await o.goto(BASE + '/dashboard/configuracoes'); await o.waitForSelector('[data-testid=etapa-negocio]');
for (const e of ['regras', 'premios', 'agenda', 'compartilhar', 'conta']) assert.equal(await o.locator(`[data-testid=etapa-${e}]`).count(), 0, `etapa ${e} escondida`);
assert.ok(await o.locator('nav[aria-label="Seções"] a[aria-current=step]:has-text("Seu negócio")').count());
assert.match(await o.locator('[data-testid=etapa-negocio]').innerText(), /Aparece para o cliente|Início do app/i);
console.log('1. só a etapa 1 (Seu negócio) aparece, marcada no menu OK');

// 2. clicar em outra etapa troca o conteúdo; "Próximo" avança; a última não tem "Próximo"
await o.click('nav[aria-label="Seções"] >> text=Ganhar pontos'); await o.waitForSelector('[data-testid=etapa-regras]');
assert.equal(await o.locator('[data-testid=etapa-negocio]').count(), 0);
assert.ok(await o.locator('#pontos').count());
await o.click('[data-testid=etapa-nav] >> text=/Próximo: Prêmios/'); await o.waitForSelector('[data-testid=etapa-premios]');
assert.ok(await o.locator('#produtos').count());
await o.goto(BASE + '/dashboard/configuracoes?etapa=conta'); await o.waitForSelector('[data-testid=etapa-conta]');
assert.equal(await o.locator('[data-testid=etapa-nav] >> text=/Próximo/').count(), 0);
assert.ok(await o.locator('[data-testid=etapa-nav] >> text=/Rede de lugares/').count());
console.log('2. troca de etapa, Próximo/Anterior e fim do caminho OK');

// 3. etapa inválida cai na primeira; abrir=tudo mostra todas
await o.goto(BASE + '/dashboard/configuracoes?etapa=xyz'); await o.waitForSelector('[data-testid=etapa-negocio]');
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('[data-testid=etapa-conta]');
assert.equal(await o.locator('[data-testid^=etapa-]:not([data-testid=etapa-nav])').count(), 6);
console.log('3. etapa inválida volta à primeira e abrir=tudo mostra as 6 OK');

// 4. atalhos de fora vão direto à etapa e ao bloco certos
await o.goto(BASE + '/dashboard/agenda'); await o.waitForSelector('h1');
const hrefs = await o.locator('a[href*="configuracoes#"], a[href*="configuracoes?"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
assert.ok(hrefs.every((h) => /etapa=/.test(h)), 'links da agenda usam etapa: ' + hrefs.join(' '));
await o.goto(BASE + '/dashboard/configuracoes?etapa=regras&abrir=campanhas#campanhas'); await o.waitForSelector('#campanhas[open]');
console.log('4. atalhos usam ?etapa= e abrem o bloco pedido OK');

// 5. prévia da campanha: cor, multiplicador, nome e dias refletem ao vivo
await o.waitForTimeout(1500);
const prev = o.locator('[data-testid=promo-preview]');
await o.fill('#p-title', 'Terça em dobro');
await o.selectOption('#p-mult', '3');
await o.check('input[name=weekdays][value="2"]', { force: true });
await o.check('input[name=color][value="roxo"]', { force: true });
await o.waitForFunction(() => document.querySelector('[data-testid=promo-preview]')?.innerText.includes('Terça em dobro'));
const txt = await prev.innerText();
assert.match(txt, /3x/); assert.match(txt, /Ter/); assert.match(txt, /Valendo agora/);
const bg = await prev.locator('span').first().evaluate((el) => getComputedStyle(el).backgroundColor);
assert.equal(bg, 'rgb(124, 58, 237)', 'cor roxa na prévia');
await o.selectOption('#p-kind', 'BONUS'); await o.fill('#p-bonus', '50');
await o.waitForFunction(() => document.querySelector('[data-testid=promo-preview]')?.innerText.includes('+50'));
console.log('5. prévia da campanha muda com nome, tipo, dias e cor OK');

// 6. prévia do prêmio: nome, pontos, valor e foto
await o.goto(BASE + '/dashboard/configuracoes?etapa=premios'); await o.waitForSelector('[data-testid=reward-preview]'); await o.waitForTimeout(1500);
const rp = o.locator('[data-testid=reward-preview]');
assert.match(await rp.innerText(), /Nome do produto/);
assert.equal(await rp.locator('img').count(), 0);
await o.fill('input[name=name][placeholder^="Ex.: Sobremesa"]', 'Milkshake');
await o.fill('input[name=pointsCost]', '800');
await o.fill('#rw-cash', '9,50');
await o.waitForFunction(() => document.querySelector('[data-testid=reward-preview]')?.innerText.includes('Milkshake'));
assert.match(await rp.innerText(), /R\$\s*9,50 \+ 800 pts/);
await o.locator('form:has(input[name=imageData]) input[type=file]').setInputFiles('prato.png');
await o.waitForFunction(() => document.querySelector('[data-testid=reward-preview] img'), null, { timeout: 8000 });
console.log('6. prévia do prêmio mostra nome, preço e a foto escolhida OK');

// 7. mobile: menu em chips, sem rolagem horizontal
const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
await mctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const m = await mctx.newPage();
await m.goto(BASE + '/login'); await m.fill('#email', 'ze@burger.com'); await m.fill('#password', 'senha-segura-1'); await m.click('button[type=submit]'); await m.waitForURL('**/dashboard');
for (const e of ['negocio', 'regras', 'premios', 'agenda']) {
  await m.goto(BASE + `/dashboard/configuracoes?etapa=${e}`); await m.waitForSelector(`[data-testid=etapa-${e}]`); await m.waitForTimeout(500);
  assert.ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `sem rolagem lateral em ${e}`);
}
assert.ok(await m.locator('nav.chip-row a.chip-link-active').count());
console.log('7. celular: chips de etapas e sem rolagem lateral OK');
await b.close();
console.log('ALL OK (regras por etapa)');
