// Início e Perfil do cliente redesenhados: atalhos em fileira no fim do Início (com número quando há algo esperando), lista agrupada no
// Perfil, cartão da carteira em largura total quando há um lugar só; Agendar sem dia escolhido abre no primeiro dia com vaga.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' limit 1`);
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingBufferMin"=0; delete from "Customer" where email='solo@teste.com'`);
sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash","termsAcceptedAt","termsVersion") select gen_random_uuid()::text,'00000000272',phone,'Solo Teste','solo@teste.com',"passwordHash","termsAcceptedAt","termsVersion" from "Customer" where email='lucas@teste.com'`);
const solo = sql(`select id from "Customer" where email='solo@teste.com'`);
sql(`insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid()::text,'${solo}','${rid}',250)`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'solo@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
const noOverflow = async (what) => assert.ok(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${what}: sem rolagem lateral`);

// 1. Início: os atalhos ficam depois de "Explorar lugares", em uma fileira de quatro
await c.waitForSelector('[data-testid=shortcut-tiles]');
const tiles = await c.locator('[data-testid=shortcut-tiles] a').evaluateAll((els) => els.map((e) => ({ href: e.getAttribute('href'), top: Math.round(e.getBoundingClientRect().top) })));
assert.deepEqual(tiles.map((t) => t.href), ['/perfil/pontos', '/perfil/premios', '/perfil/pedidos', '/perfil/agendamentos']);
assert.equal(new Set(tiles.map((t) => t.top)).size, 1, 'os quatro na mesma linha');
const order = await c.evaluate(() => {
  const y = (el) => el.getBoundingClientRect().top + window.scrollY;
  return [[...document.querySelectorAll('a')].find((a) => a.textContent.includes('Explorar lugares perto de você')), document.querySelector('[data-testid=shortcut-tiles]')].map(y);
});
assert.ok(order[0] < order[1], 'atalhos depois de Explorar lugares');
await noOverflow('início');
console.log('1. Início: atalhos em fileira depois de "Explorar lugares" OK');

// 2. um lugar só: o cartão da carteira ocupa a largura toda (não fica pela metade)
const card = await c.locator(`a[href="/carteira/${rid}"]`).first().boundingBox();
assert.ok(card.width > 390 * 0.8, `cartão com largura total (${card.width})`);
console.log('2. carteira única em largura total OK');

// 3. números nos atalhos: cupom a retirar e horário marcado
const rewardId = sql(`select id from "Reward" where "restaurantId"='${rid}' and not "birthdayOnly" order by "pointsCost" limit 1`);
const wallet = sql(`select id from "Wallet" where "customerId"='${solo}'`);
sql(`insert into "Redemption"(id,"restaurantId","customerId","walletId","rewardId","rewardName","pointsCost",code,status) values (gen_random_uuid()::text,'${rid}','${solo}','${wallet}','${rewardId}','Teste e66',0,'E66TST','PENDING')`);
await c.goto(BASE + '/carteira'); await c.waitForSelector('[data-testid=shortcut-tiles]');
assert.match(await c.locator('[data-testid=shortcut-tiles] a[href="/perfil/premios"]').innerText(), /Prêmios/);
assert.equal(await c.locator('[data-testid=shortcut-tiles] a[href="/perfil/premios"] [aria-label$="esperando"]').innerText(), '1');
assert.equal(await c.locator('[data-testid=shortcut-tiles] a[href="/perfil/pontos"] [aria-label$="esperando"]').count(), 0, 'sem número onde não há nada');
console.log('3. número no atalho de prêmios (1 cupom a retirar) e nada nos demais OK');

// 4. Perfil: lista agrupada com título, frase e seta; um clique leva à tela
await c.goto(BASE + '/perfil'); await c.waitForSelector('[data-testid=shortcut-groups]');
const groups = await c.locator('[data-testid=shortcut-groups] h2').allInnerTexts();
assert.deepEqual(groups.map((g) => g.toLowerCase()), ['minha atividade', 'pedidos e horários']);
assert.equal(await c.locator('[data-testid=shortcut-groups] a').count(), 4);
assert.match(await c.locator('[data-testid=my-orders-link]').innerText(), /Meus pedidos/);
const rows = await c.locator('[data-testid=shortcut-groups] a').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
assert.ok(rows.every((h) => h < 90), `linhas compactas ${rows}`);
await noOverflow('perfil');
await c.click('a[href="/perfil/agendamentos"]'); await c.waitForURL('**/perfil/agendamentos');
await c.waitForSelector('text=Nada marcado. Em Lugares, abra um lugar');
console.log('4. Perfil: atalhos agrupados e compactos, texto vazio de agendamentos aponta para Lugares OK');

// 5. Agendar sem dia: com hoje fechado, abre direto no próximo dia com vaga
const weekday = Number(sql(`select extract(dow from (now() at time zone 'America/Sao_Paulo'))::int`));
const sched = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: day === weekday, open: '00:00', close: '23:59' })));
sql(`update "Unit" set "openingSchedule"='${sched}'::jsonb where id='${unit}'; delete from "ResourceService"; delete from "Service" where "restaurantId"='${rid}'; delete from "Resource" where "restaurantId"='${rid}'`);
const ana = sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','Ana',1) returning id`).split('\n')[0];
const sid = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Corte',30,5000) returning id`).split('\n')[0];
sql(`insert into "ResourceService"(id,"resourceId","serviceId") values (gen_random_uuid()::text,'${ana}','${sid}')`);
await c.goto(BASE + `/lugar/${rid}/agendar?servico=${sid}`); await c.waitForSelector('text=Escolha o dia');
assert.match(c.url(), /[?&]data=\d{4}-\d{2}-\d{2}/, 'redirecionou para um dia com vaga');
const today = sql(`select to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD')`);
assert.ok(!c.url().includes(`data=${today}`), 'não ficou em hoje');
assert.ok(await c.locator('ul:has(a[href*="hora="])').count() > 0, 'mostra horários livres');
// quem escolhe o dia fechado (hoje) vê o aviso normal, sem ser empurrado
await c.goto(BASE + `/lugar/${rid}/agendar?servico=${sid}&data=${today}`); await c.waitForSelector('text=Sem horários livres neste dia');
assert.ok(c.url().includes(`data=${today}`));
console.log('5. Agendar abre no primeiro dia com vaga; hoje escolhido à mão não é trocado OK');

sql(`delete from "Redemption" where code='E66TST'; delete from "Customer" where email='solo@teste.com'`);
await b.close();
