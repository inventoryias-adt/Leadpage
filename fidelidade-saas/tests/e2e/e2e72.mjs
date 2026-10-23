// Gestão financeira: entradas por origem (agenda, pedidos, caixa, lançadas), despesas avulsas e fixas, comissão por profissional,
// resultado do mês, navegação entre meses (no relógio de Brasília), planilha CSV e acesso só do dono.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const M = '2025-03'; // um mês fechado, longe dos dados que os outros testes criam
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
sql(`truncate "RateLimit"; delete from "FinanceEntry"; delete from "CommissionPayout"; delete from "Resource" where name='Barbeiro Financeiro'`);
sql(`delete from "Booking" where "serviceName" like 'Fin %'; delete from "Order" where code like 'FIN%'; delete from "Claim" where description like 'Fin %'`);
assert.equal(sql(`select (select count(*) from "Booking" where "restaurantId"='${rid}' and "completedAt" >= '2025-03-01' and "completedAt" < '2025-04-02') + (select count(*) from "Claim" where "restaurantId"='${rid}' and "redeemedAt" >= '2025-03-01' and "redeemedAt" < '2025-04-02')`), '0', 'o mês de teste precisa estar vazio');

const res = sql(`insert into "Resource"(id,"restaurantId",name) values (gen_random_uuid()::text,'${rid}','Barbeiro Financeiro') returning id`).split('\n')[0];
const booking = (price, discount, status, doneAt, claim = null) => sql(`insert into "Booking"(id,"restaurantId","unitId","guestName","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","discountCents","completedAt","claimId") values (gen_random_uuid()::text,'${rid}','${unit}','Fin cliente','${res}','${doneAt}'::timestamptz,'${doneAt}'::timestamptz + interval '30 min','${status}','Fin corte',30,${price},${discount},${status === 'COMPLETED' ? `'${doneAt}'::timestamptz` : 'null'},${claim ? `'${claim}'` : 'null'}) returning id`).split('\n')[0];
const claim = (amount, at, desc) => sql(`insert into "Claim"(id,token,"restaurantId","amountCents",points,description,"expiresAt","redeemedAt") values (gen_random_uuid()::text,gen_random_uuid()::text,'${rid}',${amount},0,'${desc}','${at}'::timestamptz + interval '1 hour','${at}'::timestamptz) returning id`).split('\n')[0];
const linked = claim(4500, '2025-03-10T15:00:00Z', 'Fin atendimento (ligado ao agendamento)');
booking(5000, 500, 'COMPLETED', '2025-03-10T15:00:00Z', linked); // 45,00 pagos
booking(8000, 0, 'COMPLETED', '2025-04-01T02:30:00Z'); // 23h30 de 31/03 em Brasília: ainda é março
booking(3000, 0, 'COMPLETED', '2025-04-01T03:30:00Z'); // 00h30 de 1º/04 em Brasília: é abril
booking(9999, 0, 'CANCELED', '2025-03-12T15:00:00Z'); // cancelado não conta
claim(12000, '2025-03-15T15:00:00Z', 'Fin compra no caixa'); // 120,00 no caixa
sql(`insert into "Order"(id,"restaurantId","customerId",code,status,"totalCents","prepMin","pickedUpAt") values (gen_random_uuid()::text,'${rid}','${lucas}','FIN001','PICKED_UP',2500,10,'2025-03-20T15:00:00Z')`); // 25,00 em pedidos
sql(`insert into "FinanceEntry"(id,"restaurantId",kind,description,category,"amountCents",date,recurrence) values
  (gen_random_uuid()::text,'${rid}','OUT','Aluguel da loja','Aluguel',200000,'2025-01-31','MONTHLY'),
  (gen_random_uuid()::text,'${rid}','OUT','Compra de lâminas','Insumos e estoque',35000,'2025-03-12','NONE'),
  (gen_random_uuid()::text,'${rid}','IN','Gorjetas da semana','Gorjeta',10000,'2025-03-12','NONE')`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (w, h) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return [p, ctx];
};
const [O, octx] = await mk(1100, 1000);
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
const text = async (sel) => (await O.locator(sel).innerText()).replace(/\s+/g, ' ');
const go = async (m) => { await O.goto(BASE + `/dashboard/financeiro?mes=${m}`); await O.waitForSelector('[data-testid=finance-kpis]'); };

// 1. atalho no Início e totais do mês (agenda 45+80, caixa 120 sem repetir o agendamento ligado, pedidos 25, gorjeta 100)
await O.waitForSelector('[data-testid=finance-shortcut]'); await O.click('[data-testid=finance-shortcut]'); await O.waitForURL('**/dashboard/financeiro');
await go(M);
assert.match(await text('[data-testid=month-label]'), /março de 2025/i);
assert.match(await text('[data-testid=kpi-in]'), /R\$ 370,00/);
assert.match(await text('[data-testid=kpi-out]'), /R\$ 2\.350,00/); // aluguel fixo (dia 31) 2.000 + lâminas 350
assert.match(await text('[data-testid=kpi-result]'), /-R\$ 1\.980,00|−R\$ 1\.980,00|R\$ -1\.980,00/);
const src = await text('[data-testid=finance-sources]');
assert.match(src, /Agenda 2 atendimentos concluídos R\$ 125,00/);
assert.match(src, /Caixa 1 lançamento de compras R\$ 120,00/);
assert.match(src, /Pedidos 1 pedido retirado R\$ 25,00/);
assert.match(src, /Lançadas por você entradas e clube de assinatura R\$ 100,00/);
const cats = await text('[data-testid=finance-categories]');
assert.match(cats, /Aluguel R\$ 2\.000,00/); assert.match(cats, /Insumos e estoque R\$ 350,00/);
console.log('1. totais do mês por origem; o agendamento não conta duas vezes; 23h30 de 31/03 é março e 00h30 de 1º/04 é abril OK');

// 2. comissão: sem percentual, o profissional aparece com 0; salva 40% → 40% de R$ 125,00 = R$ 50,00
const row = O.locator('[data-testid=commission-row]', { hasText: 'Barbeiro Financeiro' });
await row.waitFor();
assert.match((await row.innerText()).replace(/\s+/g, ' '), /2 atendimentos · R\$ 125,00/);
await row.locator('[data-testid=commission-pct]').fill('40'); await row.locator('[data-testid=commission-save]').click();
await O.waitForFunction(() => document.querySelector('[data-testid=commission-value]')?.textContent?.includes('50,00'));
assert.equal(sql(`select "commissionBp" from "Resource" where id='${res}'`), '4000');
await row.locator('[data-testid=commission-pct]').fill('150'); await row.locator('[data-testid=commission-save]').click(); await row.locator('text=0 a 100').waitFor();
assert.equal(sql(`select "commissionBp" from "Resource" where id='${res}'`), '4000', 'percentual inválido não grava');
console.log('2. comissão de 40% sobre os atendimentos do mês = R$ 50,00; percentual inválido é recusado OK');

// 3. registrar o pagamento: vira "Pago", entra como saída (no mês do pagamento), só uma vez; desfazer volta
await row.locator('[data-testid=commission-pay]').click(); await row.locator('[data-testid=commission-paid]').waitFor();
assert.equal(sql(`select count(*)||'|'||"amountCents" from "CommissionPayout" where "resourceId"='${res}' and month='${M}' group by "amountCents"`), '1|5000');
await O.goto(BASE + '/dashboard/financeiro'); await O.waitForSelector('[data-testid=finance-categories]');
assert.match(await text('[data-testid=finance-categories]'), /Comissões R\$ 50,00/);
await go(M);
await O.locator('[data-testid=commission-undo]').click(); await O.locator('[data-testid=commission-pay]').waitFor();
assert.equal(sql(`select count(*) from "CommissionPayout"`), '0');
console.log('3. pagar a comissão: vira saída do mês do pagamento, não duplica e dá para desfazer OK');

// 4. lançar despesa pelo formulário: valida, salva, aparece na lista e some ao excluir
await O.locator('[data-testid=entry-new]').click();
await O.fill('[data-testid=entry-desc]', 'x'); await O.fill('[data-testid=entry-amount]', '80,00'); await O.fill('[data-testid=entry-date]', '2025-03-18');
await O.click('[data-testid=entry-save]'); await O.waitForSelector('text=Descreva o lançamento');
await O.fill('[data-testid=entry-desc]', 'Taxa da maquininha'); await O.fill('[data-testid=entry-amount]', '0');
await O.click('[data-testid=entry-save]'); await O.waitForSelector('text=maior que zero');
await O.selectOption('[data-testid=entry-cat]', 'Impostos e taxas'); await O.fill('[data-testid=entry-amount]', '80,00'); await O.fill('[data-testid=entry-date]', '2025-03-18');
await O.click('[data-testid=entry-save]'); await O.waitForSelector('[data-testid=entry-row]:has-text("Taxa da maquininha")');
assert.match(await text('[data-testid=kpi-out]'), /R\$ 2\.430,00/);
await O.locator('[data-testid=entry-row]', { hasText: 'Taxa da maquininha' }).locator('[data-testid=entry-delete]').click();
await O.waitForFunction(() => !document.body.innerText.includes('Taxa da maquininha'));
assert.match(await text('[data-testid=kpi-out]'), /R\$ 2\.350,00/);
console.log('4. lançar despesa (com validação), ver na lista e excluir OK');

// 5. despesa fixa: vale em abril; "Encerrar daqui" em abril a tira de abril em diante, mas março continua com ela
await go('2025-04');
assert.ok(await O.locator('[data-testid=entry-row]', { hasText: 'Aluguel da loja' }).locator('text=fixa').count());
assert.match((await O.locator('[data-testid=entry-row]', { hasText: 'Aluguel da loja' }).innerText()).replace(/\s+/g, ' '), /30\/04/); // dia 31 vira o último dia do mês
await O.locator('[data-testid=entry-row]', { hasText: 'Aluguel da loja' }).locator('[data-testid=entry-end]').click();
await O.waitForFunction(() => !document.body.innerText.includes('Aluguel da loja'));
assert.equal(sql(`select "endsOn"::text from "FinanceEntry" where description='Aluguel da loja'`), '2025-03-31');
await go(M);
assert.match(await text('[data-testid=kpi-out]'), /R\$ 2\.350,00/);
console.log('5. despesa fixa: repete todo mês no último dia quando o mês é mais curto, e "Encerrar daqui" preserva o passado OK');

// 6. navegação: ‹ vai ao mês anterior, › não passa do mês atual, mês futuro na URL volta ao atual
await O.click('[data-testid=month-prev]'); await O.waitForFunction(() => document.querySelector('[data-testid=month-label]')?.textContent?.toLowerCase().includes('fevereiro'));
await O.goto(BASE + '/dashboard/financeiro?mes=2999-01'); await O.waitForSelector('[data-testid=month-label]');
assert.equal(await O.locator('[data-testid=month-next]').count(), 0);
assert.ok(await O.locator('[data-testid=finance-chart] a').count() === 6);
console.log('6. navegação entre meses e limite no mês atual OK');

// 7. planilha CSV do mês
const csv = await O.request.get(BASE + `/dashboard/exportar/financeiro?mes=${M}`);
assert.equal(csv.status(), 200); assert.match(csv.headers()['content-disposition'], /financeiro-2025-03/);
const body = await csv.text();
assert.match(body, /Aluguel da loja \(fixa\)/); assert.match(body, /Gorjetas da semana/); assert.match(body, /Total;;março de 2025;;370,00;2350,00/); assert.match(body, /Resultado: faltou;;março de 2025;;1980,00;/);
assert.doesNotMatch(body, /'-/, 'nenhum valor com apóstrofo de proteção');
console.log('7. planilha CSV do mês OK');

// 8. só o dono: visitante é mandado ao login; cliente (outra sessão) também
const [A] = await mk(900, 800);
await A.goto(BASE + '/dashboard/financeiro'); await A.waitForURL('**/login**');
assert.equal((await (await A.context().request.get(BASE + '/dashboard/exportar/financeiro', { maxRedirects: 0 })).status()), 307);
console.log('8. sem login não acessa a tela nem a planilha OK');

// 9. celular: sem rolagem lateral e o gráfico cabe
const [P] = await mk(390, 844);
await P.goto(BASE + '/login'); await P.fill('#email', 'ze@burger.com'); await P.fill('#password', 'senha-segura-1'); await P.click('button[type=submit]'); await P.waitForURL('**/dashboard');
await P.goto(BASE + `/dashboard/financeiro?mes=${M}`); await P.waitForSelector('[data-testid=finance-chart]');
assert.ok(await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sem rolagem lateral no celular');
console.log('9. celular sem rolagem lateral OK');

sql(`delete from "FinanceEntry"; delete from "CommissionPayout"; delete from "Booking" where "serviceName" like 'Fin %'; delete from "Order" where code like 'FIN%'; delete from "Claim" where description like 'Fin %'; delete from "Resource" where name='Barbeiro Financeiro'`);
await b.close();
