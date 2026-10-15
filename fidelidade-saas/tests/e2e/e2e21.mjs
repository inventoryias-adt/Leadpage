import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '18:00' })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=0,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2,"pointsPerReal"=10,"pointsPerRealOff"=100; delete from "Booking"; delete from "Service"; delete from "Resource"; update "Unit" set "openingSchedule"='${week}'::jsonb`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','João',1)`);
sql(`update "Wallet" set balance=3000 where "customerId"='${lucas}' and "restaurantId"='${rid}'`);
const balance = () => Number(sql(`select balance from "Wallet" where "customerId"='${lucas}' and "restaurantId"='${rid}'`));

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const octx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await octx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const o = await octx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');

// 1. dono: regra de conversão com a dica de quanto volta, e serviço que aceita pontos
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('#ag-rate');
await o.waitForSelector('text=voltam cerca de'); assert.match(await o.locator('#agenda').innerText(), /10%/);
await o.fill('#ag-rate', '200'); assert.match(await o.locator('#agenda').innerText(), /5%/, 'a dica acompanha o número digitado');
await o.fill('#ag-rate', '100'); await o.click('#agenda button:has-text("Salvar regras")'); await o.waitForSelector('#agenda >> text=Regras de agendamento salvas.');
assert.equal(sql(`select "pointsPerRealOff" from "Restaurant" where id='${rid}'`), '100');
await o.fill('#sv-name', 'Corte masculino'); await o.fill('#sv-dur', '30'); await o.fill('#sv-price', '50,00'); await o.selectOption('#sv-pts', '50');
await o.click('#agenda button:has-text("Adicionar serviço")'); await o.waitForSelector('#agenda >> text=aceita pontos (até 50%)');
assert.equal(sql(`select "pointsDiscountMaxPct" from "Service" where name='Corte masculino'`), '50');
await o.fill('#sv-name', 'Consulta grátis'); await o.fill('#sv-dur', '15'); await o.selectOption('#sv-pts', '50'); await o.click('#agenda button:has-text("Adicionar serviço")'); await o.waitForSelector('#agenda >> text=Consulta grátis');
assert.equal(sql(`select "pointsDiscountMaxPct" from "Service" where name='Consulta grátis'`), '0', 'serviço sem preço não aceita pontos');
console.log('1. dono: conversão com dica de retorno e serviço que aceita pontos (sem preço, não) OK');

// 2. cliente usa pontos
const svc = sql(`select id from "Service" where name='Corte masculino'`);
const lctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await lctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const l = await lctx.newPage(); l.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await l.goto(BASE + '/entrar'); await l.fill('#c-email', 'lucas@teste.com'); await l.fill('#c-password', 'senha-cliente-1'); await l.click('button[type=submit]'); await l.waitForURL('**/carteira**');
const pick = async (time) => {
  await l.goto(`${BASE}/lugar/${rid}/agendar?servico=${svc}`);
  await l.waitForSelector('text=Aceita pontos como desconto, até 50% do preço.');
  await l.locator('ul.chip-row li a:has-text("Amanhã")').click(); await l.waitForSelector('ul.chip-row a[aria-current=date]:has-text("Amanhã")');
  await l.click(`ul.grid a:has-text("${time}")`); await l.waitForSelector('text=Usar meus pontos como desconto');
};
await pick('10:00');
assert.match(await l.locator('dl').innerText(), /A pagar no local\s*R\$\s*50,00/);
await l.check('input[type=checkbox] >> nth=0'); // usar pontos
await l.click('text=Usar o máximo');
assert.match(await l.locator('dl').innerText(), /Desconto com pontos\s*− R\$\s*25,00/);
assert.match(await l.locator('dl').innerText(), /A pagar no local\s*R\$\s*25,00/);
await l.screenshot({ path: 'desc-confirmar.png', fullPage: true });
await l.click('button:has-text("Confirmar agendamento")'); await l.waitForURL('**/perfil/agendamentos**'); await l.waitForSelector('text=desconto de R$ 25,00');
assert.equal(sql(`select "pointsUsed"||'|'||"discountCents" from "Booking"`), '2500|2500');
assert.equal(balance(), 500, 'pontos saem da carteira na hora');
assert.equal(sql(`select count(*) from "Transaction" where type='REDEEM' and description='Desconto no agendamento: Corte masculino'`), '1');
console.log('2. cliente usa o máximo: R$ 25,00 de desconto, 2.500 pontos debitados na hora OK');

// 3. o servidor não confia no navegador: mais pontos do que o permitido é recusado
await pick('11:00');
await l.check('input[type=checkbox] >> nth=0');
await l.evaluate(() => { document.querySelector('input[name=usePoints]').value = '9999'; });
await l.click('button:has-text("Confirmar agendamento")'); await l.waitForSelector('text=mais pontos do que pode usar');
assert.equal(balance(), 500); assert.equal(sql(`select count(*) from "Booking"`), '1');
console.log('3. pedido de pontos além do permitido é recusado no servidor OK');

// 4. cancelar devolve os pontos (uma vez)
await l.goto(BASE + '/perfil/agendamentos');
await l.click('button[aria-label="Cancelar Corte masculino"]'); await l.waitForSelector('text=Agendamento cancelado.');
assert.equal(balance(), 3000, 'pontos de volta');
assert.equal(sql(`select count(*) from "Transaction" where description like 'Pontos devolvidos:%'`), '1');
console.log('4. cancelar devolve os 2.500 pontos OK');

// 5. concluir: pontos ganhos sobre o valor pago; dono vê quanto cobrar
await pick('14:00');
await l.check('input[type=checkbox] >> nth=0'); await l.click('text=Usar o máximo');
await l.click('button:has-text("Confirmar agendamento")'); await l.waitForURL('**/perfil/agendamentos**');
const todayStart = `((date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') at time zone 'UTC')`;
sql(`update "Booking" set "startsAt"=${todayStart}+interval '1 hour', "endsAt"=${todayStart}+interval '90 minutes' where status='CONFIRMED'`);
await o.goto(BASE + '/dashboard/agenda'); await o.waitForSelector('text=a cobrar R$ 25,00'); await o.waitForSelector('text=Desconto de R$ 25,00 com 2.500 pontos');
await o.screenshot({ path: 'desc-dono.png', fullPage: true });
await o.click('button:has-text("Concluir")'); await o.waitForSelector('text=pontos creditados ao cliente');
assert.equal(sql(`select c."amountCents" from "Claim" c join "Booking" b on b."claimId"=c.id`), '2500', 'a venda é o valor pago');
assert.equal(sql(`select "pointsAwarded" from "Booking" where status='COMPLETED'`), '250', 'R$ 25,00 pagos × 10 pontos');
assert.equal(balance(), 500 + 250);
console.log('5. concluir: 250 pontos sobre os R$ 25,00 pagos; dono vê "a cobrar" OK');

await b.close();
console.log('ALL OK (pontos como desconto)');
