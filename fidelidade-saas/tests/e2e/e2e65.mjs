// Painel do dono: tocar num dia do gráfico de vendas e num horário do mapa de calor abre o detalhe (números, comparação com a semana
// anterior, o que pode explicar o dia, compras e links); Esc fecha; o servidor só devolve dados do próprio estabelecimento.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now() where id='${rid}'; delete from "PromotionUse" where "restaurantId"='${rid}'; delete from "Redemption" where "restaurantId"='${rid}' and "rewardName"='Sobremesa e65'; delete from "Claim" where "restaurantId"='${rid}' and description like 'e65%'`);
// Brasília: ontem e o mesmo dia da semana anterior, sempre às 12h (12h BRT = 15h UTC)
const at = (daysAgo, hourBrt) => `((date_trunc('day', now() at time zone 'America/Sao_Paulo') - interval '${daysAgo} day' + interval '${hourBrt} hour') at time zone 'America/Sao_Paulo')`;
const claim = (daysAgo, hourBrt, cents, points, desc) => sql(`insert into "Claim"(id,token,"restaurantId","amountCents",points,description,"createdAt","expiresAt","redeemedAt","customerId") values (gen_random_uuid()::text,gen_random_uuid()::text,'${rid}',${cents},${points},'${desc}',${at(daysAgo, hourBrt)},${at(daysAgo, hourBrt)} + interval '1 hour',${at(daysAgo, hourBrt)},'${lucas}') returning id`).split('\n')[0];
const c1 = claim(1, 12, 10000, 100, 'e65 ontem 1');
claim(1, 12, 5000, 50, 'e65 ontem 2');
claim(1, 19, 2000, 20, 'e65 ontem noite');
claim(8, 12, 4000, 40, 'e65 semana passada');
sql(`insert into "PromotionUse"(id,"restaurantId",title,"claimId","customerId",points,"amountCents","createdAt") values (gen_random_uuid()::text,'${rid}','Terça em dobro','${c1}','${lucas}',100,10000,${at(1, 12)})`);
const dow = Number(sql(`select extract(dow from (now() at time zone 'America/Sao_Paulo') - interval '1 day')::int`));

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const O = await ctx.newPage(); O.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
await O.goto(BASE + '/dashboard?dias=7'); await O.waitForSelector('[data-testid=area-point-5]');

// o mapa rola para o lado no celular: leva a célula até a vista e espera a rolagem parar antes de tocar
const tap = async (sel) => { await O.locator(sel).scrollIntoViewIfNeeded(); await O.waitForTimeout(700); await O.click(sel); };

// 1. tocar no dia de ontem (penúltimo ponto da série de 7 dias) abre o detalhe do dia
await O.click('[data-testid=area-point-5]'); await O.waitForSelector('[data-testid=day-detail]');
const day = await O.locator('[data-testid=day-detail]').innerText();
assert.match(day, /R\$\s?170,00/, 'vendas do dia (100 + 50 + 20)');
assert.match(day, /semana anterior: 1/, 'compras da semana anterior');
assert.match(day, /ticket médio/i);
console.log('1. tocar num dia abre o detalhe com vendas, compras e ticket médio OK');

// 2. o que pode explicar: comparação com a semana anterior e a campanha usada
const reasons = await O.locator('[data-testid=day-reasons]').innerText();
assert.match(reasons, /mais compras do que no mesmo dia da semana anterior/);
assert.match(reasons, /Terça em dobro/);
assert.match(await O.locator('[data-testid=day-detail]').innerText(), /e65 ontem|Teste|Lucas/i);
console.log('2. "o que pode explicar" cita a semana anterior e a campanha usada OK');

// 3. links levam ao Caixa filtrado pelo dia e Esc fecha
const href = await O.locator('a:has-text("Abrir no Caixa")').getAttribute('href');
assert.match(href, /^\/dashboard\/caixa\?de=\d{4}-\d{2}-\d{2}&ate=\d{4}-\d{2}-\d{2}#lancamentos$/);
await O.keyboard.press('Escape'); await O.waitForSelector('[data-testid=detail-sheet]', { state: 'detached' });
console.log('3. link para o Caixa do dia e Esc fecha OK');

// 4. dia sem compras explica que não houve movimento
await O.click('[data-testid=area-point-2]'); await O.waitForSelector('[data-testid=day-detail]');
assert.match(await O.locator('[data-testid=day-reasons]').innerText(), /Sem compras lançadas/);
await O.click('[data-testid=detail-close]'); await O.waitForSelector('[data-testid=detail-sheet]', { state: 'detached' });
console.log('4. dia sem compras OK');

// 5. mapa de calor: tocar no horário de ontem às 12h
await tap(`[data-testid=heat-${dow}-12]`); await O.waitForSelector('[data-testid=slot-detail]');
const slot = await O.locator('[data-testid=slot-detail]').innerText();
assert.match(slot, /\n3\n/, 'três compras nesse horário: duas de ontem e uma de oito dias atrás');
assert.match(slot, /R\$\s?190,00/);
assert.match(await O.locator('[data-testid=slot-tips]').innerText(), /semanas neste horário/);
assert.match(slot, /últimas vezes/i);
await O.keyboard.press('Escape'); await O.waitForSelector('[data-testid=detail-sheet]', { state: 'detached' });
console.log('5. mapa de calor: detalhe do horário com compras, vendas e dicas OK');

// 6. horário vazio sugere campanha
await tap(`[data-testid=heat-${dow}-4]`); await O.waitForSelector('[data-testid=slot-detail]');
assert.match(await O.locator('[data-testid=slot-tips]').innerText(), /Ninguém comprou neste horário/);
console.log('6. horário sem compras sugere campanha OK');

sql(`delete from "PromotionUse" where "restaurantId"='${rid}'; delete from "Claim" where "restaurantId"='${rid}' and description like 'e65%'`);
await b.close();
