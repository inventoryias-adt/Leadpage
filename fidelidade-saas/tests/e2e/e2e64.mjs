// Presente do aniversariante: o dono configura em Regras (grátis / por pontos / ao consumir R$ X); no dia do aniversário o cliente vê o
// parabéns no Início e em Lugares, pega o cupom na página do lugar (um por ano), o dono dá baixa em Resgates; fora do dia nada aparece.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; delete from "Redemption" where "rewardName" like '%niversari%' or "rewardId" in (select id from "Reward" where "birthdayOnly")`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const today = sql(`select extract(day from now() at time zone 'America/Sao_Paulo')::int||'|'||extract(month from now() at time zone 'America/Sao_Paulo')::int`).split('|');
const other = today[1] === '12' ? 1 : Number(today[1]) + 1;
const setBirthday = (d, m) => sql(`update "Customer" set "birthDay"=${d},"birthMonth"=${m} where id='${lucas}'`);
setBirthday(today[0], today[1]);
sql(`update "Restaurant" set "guideDoneAt"=now(),"birthdayPerkOn"=false,"listed"=true where id='${rid}'`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (view) => {
  const ctx = await b.newContext({ viewport: view });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return p;
};
const O = await mk({ width: 1280, height: 900 });
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
const C = await mk({ width: 390, height: 844 });
await C.goto(BASE + '/entrar'); await C.fill('#c-email', 'lucas@teste.com'); await C.fill('#c-password', 'senha-cliente-1'); await C.click('button[type=submit]'); await C.waitForURL('**/carteira**');

// 1. aniversário sem nenhum lugar com presente: só o parabéns e o convite para comemorar
await C.goto(BASE + '/carteira'); await C.waitForSelector('[data-testid=birthday-banner]');
assert.match(await C.locator('[data-testid=birthday-banner]').innerText(), /Feliz aniversário/);
await C.goto(BASE + '/lugares'); await C.waitForSelector('[data-testid=birthday-banner]');
assert.equal(await C.locator('[data-testid=birthday-chip]').count(), 0);
assert.equal(await C.locator('[data-testid=birthday-perk]').count(), 0);
console.log('1. parabéns no Início e em Lugares mesmo sem presente OK');

// 2. o dono configura o presente em Regras (grátis)
await O.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await O.waitForSelector('#bp-on');
await O.click('#bp-on');
await O.fill('#bp-title', 'Sobremesa da casa');
await O.waitForSelector('[data-testid=perk-preview]');
assert.match(await O.locator('[data-testid=perk-preview]').innerText(), /Sobremesa da casa · grátis para o aniversariante/);
await O.click('form:has(#bp-title) button:has-text("Salvar")'); await O.waitForTimeout(1200);
assert.equal(sql(`select "birthdayPerkOn"::text||'|'||"birthdayPerkTitle"||'|'||"birthdayPerkMode" from "Restaurant" where id='${rid}'`), 'true|Sobremesa da casa|FREE');
assert.equal(sql(`select count(*) from "Reward" where "restaurantId"='${rid}' and "birthdayOnly" and active and "pointsCost"=0`), '1');
// o presente não vira prêmio comum da vitrine
await C.goto(BASE + `/lugar/${rid}/premios`);
assert.equal(await C.getByText('Sobremesa da casa').count(), 0);
console.log('2. dono configura o presente (grátis); não aparece entre os prêmios comuns OK');

// 3. o cliente vê o presente no Início, em Lugares (selo + filtro) e na página do lugar
await C.goto(BASE + '/carteira'); await C.waitForSelector('[data-testid=birthday-banner] a:has-text("Sobremesa da casa")');
await C.goto(BASE + '/lugares?filtro=aniversario'); await C.waitForSelector('[data-testid=birthday-chip]');
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=birthday-perk]');
assert.match(await C.locator('[data-testid=birthday-perk]').innerText(), /Sobremesa da casa/);
console.log('3. banner, selo/filtro em Lugares e cartão na página do lugar OK');

// 4. pega o presente: gera um cupom e leva para a carteira; um por ano
await C.click('[data-testid=birthday-perk-claim]'); await C.waitForURL(`**/carteira/${rid}`);
assert.equal(sql(`select count(*) from "Redemption" where "customerId"='${lucas}' and "restaurantId"='${rid}' and "rewardId" in (select id from "Reward" where "birthdayOnly") and status='PENDING'`), '1');
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=birthday-perk-done]');
assert.equal(await C.locator('[data-testid=birthday-perk-claim]').count(), 0);
console.log('4. cliente pega o cupom e não consegue pegar de novo OK');

// 5. o dono dá baixa em Resgates
const code = sql(`select code from "Redemption" where "customerId"='${lucas}' and "restaurantId"='${rid}' and status='PENDING' order by "createdAt" desc limit 1`);
await O.goto(BASE + `/dashboard/resgates?codigo=${code}`); await O.waitForSelector('[data-testid=codigo-valido]');
assert.match(await O.locator('[data-testid=codigo-valido]').innerText(), /Sobremesa da casa/);
await O.click('button:has-text("Entregar prêmio e dar baixa")'); await O.waitForTimeout(1200);
assert.equal(sql(`select status from "Redemption" where code='${code}'`), 'USED');
console.log('5. dono valida o código e dá baixa OK');

// 6. por pontos: sem saldo suficiente o cliente vê quanto falta (e o servidor recusa)
sql(`delete from "Redemption" where "customerId"='${lucas}' and "restaurantId"='${rid}' and "rewardId" in (select id from "Reward" where "birthdayOnly")`);
sql(`update "Restaurant" set "birthdayPerkMode"='POINTS',"birthdayPerkPoints"=100000 where id='${rid}'`);
sql(`update "Reward" set "pointsCost"=100000 where "restaurantId"='${rid}' and "birthdayOnly"`);
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=birthday-perk-short]');
assert.equal(await C.locator('[data-testid=birthday-perk-claim]').count(), 0);
console.log('6. por pontos: mostra quantos pontos faltam OK');

// 7. fora do dia do aniversário nada aparece
setBirthday(1, other);
await C.goto(BASE + '/carteira'); await C.waitForSelector('text=Suas carteiras');
assert.equal(await C.locator('[data-testid=birthday-banner]').count(), 0);
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('main');
assert.equal(await C.locator('[data-testid=birthday-perk]').count(), 0);
await C.goto(BASE + '/lugares'); await C.waitForSelector('main');
assert.equal(await C.locator('[data-testid=birthday-banner]').count(), 0);
console.log('7. fora do aniversário não aparece nada OK');

// limpeza para os próximos testes
setBirthday(15, 6);
sql(`update "Restaurant" set "birthdayPerkOn"=false where id='${rid}'`);
await b.close();
