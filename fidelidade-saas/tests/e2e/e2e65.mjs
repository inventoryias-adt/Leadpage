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
// Outros testes deixam compras em dias próximos (e perto da meia-noite de Brasília caem em "ontem"): os números esperados saem do banco.
const brl = (cents) => 'R$ ' + (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const dayStats = (daysAgo) => sql(`select count(*)||'|'||coalesce(sum("amountCents"),0) from "Claim" where "restaurantId"='${rid}' and "amountCents">0 and "redeemedAt" >= ${at(daysAgo, 0)} and "redeemedAt" < ${at(daysAgo - 1, 0)}`).split('|').map(Number);
const [cntY, sumY] = dayStats(1);
const [cntW] = dayStats(8);
const dow = Number(sql(`select extract(dow from (now() at time zone 'America/Sao_Paulo') - interval '1 day')::int`));

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const O = await ctx.newPage(); O.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
await O.goto(BASE + '/dashboard?dias=7'); await O.waitForSelector('[data-testid=area-point-5]');

// o mapa rola para o lado no celular: leva a célula até a vista e espera a rolagem parar antes de tocar
// No painel as células do mapa são pequenas (cabem sem rolar para o lado) e o gráfico acima ainda muda de altura ao carregar: o clique
// é disparado direto no botão. O toque de verdade, com células grandes, é testado na tela cheia dos horários (passo 8).
const tap = async (sel) => { await O.locator(sel).scrollIntoViewIfNeeded(); await O.waitForTimeout(500); await O.locator(sel).dispatchEvent('click'); };

// 0. o painel cabe na tela: nada rola para o lado (o mapa de horários também cabe)
assert.ok(await O.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'painel sem rolagem lateral');
console.log('0. painel sem rolagem lateral OK');

// 1. tocar no dia de ontem (penúltimo ponto da série de 7 dias) abre o detalhe do dia
await O.click('[data-testid=area-point-5]'); await O.waitForSelector('[data-testid=day-detail]');
const day = await O.locator('[data-testid=day-detail]').innerText();
assert.ok(day.replace(/\u00a0/g, ' ').includes(brl(sumY)), `vendas do dia ${brl(sumY)} em: ${day.slice(0, 120)}`);
assert.match(day, new RegExp(`semana anterior: ${cntW}`), 'compras da semana anterior');
assert.match(day, new RegExp(`COMPRAS\\s+${cntY}\\b`, 'i'), 'compras do dia');
assert.match(day, /ticket médio/i);
console.log('1. tocar num dia abre o detalhe com vendas, compras e ticket médio OK');

// 2. o que pode explicar: comparação com a semana anterior e a campanha usada
const reasons = await O.locator('[data-testid=day-reasons]').innerText();
assert.match(reasons, /compras do que no mesmo dia da semana anterior|Movimento parecido|dia novo para o seu movimento/, 'compara com a semana anterior');
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
const slotSql = sql(`select count(*)||'|'||coalesce(sum("amountCents"),0) from "Claim" where "restaurantId"='${rid}' and "amountCents">0 and "redeemedAt" >= now() - interval '90 days' and extract(dow from ("redeemedAt" at time zone 'UTC') at time zone 'America/Sao_Paulo')=${dow} and extract(hour from ("redeemedAt" at time zone 'UTC') at time zone 'America/Sao_Paulo')=12`).split('|').map(Number);
const slot = (await O.locator('[data-testid=slot-detail]').innerText()).replace(/\u00a0/g, ' ');
assert.match(slot, new RegExp(`COMPRAS\\s+${slotSql[0]}\\b`, 'i'), 'compras nesse horário');
assert.ok(slot.includes(brl(slotSql[1])), `vendas do horário ${brl(slotSql[1])}`);
assert.match(await O.locator('[data-testid=slot-tips]').innerText(), /semanas neste horário/);
assert.match(slot, /últimas vezes/i);
await O.keyboard.press('Escape'); await O.waitForSelector('[data-testid=detail-sheet]', { state: 'detached' });
console.log('5. mapa de calor: detalhe do horário com compras, vendas e dicas OK');

// 6. horário vazio sugere campanha
const busyHours = sql(`select string_agg(distinct extract(hour from ("redeemedAt" at time zone 'UTC') at time zone 'America/Sao_Paulo')::int::text, ',') from "Claim" where "restaurantId"='${rid}' and "amountCents">0 and "redeemedAt" >= now() - interval '90 days' and extract(dow from ("redeemedAt" at time zone 'UTC') at time zone 'America/Sao_Paulo')=${dow}`).split(',');
const quiet = [...Array(24).keys()].find((h) => !busyHours.includes(String(h)));
await tap(`[data-testid=heat-${dow}-${quiet}]`); await O.waitForSelector('[data-testid=slot-detail]');
assert.match(await O.locator('[data-testid=slot-tips]').innerText(), /Ninguém comprou neste horário/);
console.log('6. horário sem compras sugere campanha OK');

// 7. "Abrir tela cheia" das vendas: só os dados de vendas, com o dia a dia em lista; tocar numa linha abre o detalhe
await O.goto(BASE + '/dashboard?dias=7'); await O.waitForSelector('[data-testid=open-vendas]');
await O.click('[data-testid=open-vendas]'); await O.waitForURL('**/dashboard/vendas**');
await O.waitForSelector('[data-testid=day-list]');
assert.equal(await O.locator('[data-testid=day-list] li').count(), 7, 'uma linha por dia do período');
assert.ok(await O.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'vendas sem rolagem lateral');
const ontem = sql(`select to_char((now() at time zone 'America/Sao_Paulo') - interval '1 day','YYYY-MM-DD')`);
await O.click(`[data-testid=day-row-${ontem}]`); await O.waitForSelector('[data-testid=day-detail]');
assert.match(await O.locator('[data-testid=day-reasons]').innerText(), /Terça em dobro/);
await O.keyboard.press('Escape'); await O.waitForSelector('[data-testid=detail-sheet]', { state: 'detached' });
await O.click('a:has-text("30 dias")'); await O.waitForURL('**dias=30');
assert.equal(await O.locator('[data-testid=day-list] li').count(), 30);
console.log('7. tela cheia das vendas: resumo, gráfico, dia a dia e detalhe ao tocar OK');

// 8. "Abrir tela cheia" dos horários: melhores horários e mapa em células grandes
await O.goto(BASE + '/dashboard'); await O.waitForSelector('[data-testid=open-horarios]');
await O.click('[data-testid=open-horarios]'); await O.waitForURL('**/dashboard/horarios');
await O.waitForSelector('[data-testid=peak-grid]');
assert.ok(await O.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'horários sem rolagem lateral');
const cell = await O.locator(`[data-testid=heat-${dow}-12]`).boundingBox();
assert.ok(cell.width >= 30 && cell.height >= 30, `células grandes (${cell.width}x${cell.height})`);
assert.ok(await O.locator('[data-testid=top-slots] li').count() >= 1);
await O.locator('[data-testid=top-slots] li button').first().click(); await O.waitForSelector('[data-testid=slot-detail]');
await O.keyboard.press('Escape'); await O.waitForSelector('[data-testid=detail-sheet]', { state: 'detached' });
await O.locator(`[data-testid=heat-${dow}-12]`).scrollIntoViewIfNeeded(); await O.waitForTimeout(500); await O.click(`[data-testid=heat-${dow}-12]`); await O.waitForSelector('[data-testid=slot-detail]');
console.log('8. tela cheia dos horários: melhores horários, mapa grande e detalhe ao tocar OK');

sql(`delete from "PromotionUse" where "restaurantId"='${rid}'; delete from "Claim" where "restaurantId"='${rid}' and description like 'e65%'`);
await b.close();
