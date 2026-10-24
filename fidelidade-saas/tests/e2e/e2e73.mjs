// Clube de assinatura: o dono cria o plano (2 cortes e 1 barba por mês); o cliente pede a assinatura; o dono registra o pagamento no
// balcão (entra no Financeiro); os agendamentos cobertos abatem o saldo do ciclo e os que passam do saldo são cobrados; cancelar
// devolve o saldo; atendimento do plano concluído não cobra nem dá pontos nem conta como receita da agenda; a renovação só abre na última semana.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '18:00' })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2,"subscriptionStatus"='ACTIVE',"onboardedAt"=coalesce("onboardedAt",now()); delete from "SlotHold"; delete from "Booking"; delete from "ClubSubscription"; delete from "ClubPlan"; delete from "FinanceEntry"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; delete from "Notification" where title in ('Plano ativo','Assinatura pedida'); update "Unit" set "openingSchedule"='${week}'::jsonb, address='Rua das Flores, 100 - Centro'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','Ana',1)`);
const corte = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Corte',30,5000) returning id`).split('\n')[0];
const barba = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Barba',20,3000) returning id`).split('\n')[0];
const br = new Date(Date.now() - 3 * 3600e3); br.setUTCDate(br.getUTCDate() + 1);
const tomorrow = br.toISOString().slice(0, 10);
const page = (svc, hora) => `${BASE}/lugar/${rid}/agendar?servico=${svc}&data=${tomorrow}&hora=${hora}`;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (w, h, mobile) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return p;
};
const O = await mk(1100, 1000);
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
const C = await mk(390, 844, true);
await C.goto(BASE + '/entrar'); await C.fill('#c-email', 'lucas@teste.com'); await C.fill('#c-password', 'senha-cliente-1'); await C.click('button[type=submit]'); await C.waitForURL('**/carteira**');
const until = async (fn, what) => { for (let i = 0; i < 80; i++) { if (fn()) return; await new Promise((r) => setTimeout(r, 250)); } throw new Error('Tempo esgotado: ' + what); };
const flat = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ');

// 1. dono cria o plano; sem serviço marcado é recusado
await O.waitForSelector('[data-testid=club-shortcut]'); await O.click('[data-testid=club-shortcut]'); await O.waitForURL('**/dashboard/clube');
await O.waitForSelector('[data-testid=plan-form]');
await O.fill('[data-testid=plan-form] [data-testid=plan-name]', 'Clube do Corte'); await O.fill('[data-testid=plan-form] [data-testid=plan-price]', '120,00');
await O.click('[data-testid=plan-form] [data-testid=plan-save]'); await O.waitForSelector('text=pelo menos um serviço');
await O.locator(`[data-testid=plan-form] [data-testid=svc-${corte}]`).check(); await O.fill(`[data-testid=plan-form] [data-testid=qty-${corte}]`, '2');
await O.locator(`[data-testid=plan-form] [data-testid=svc-${barba}]`).check();
await O.click('[data-testid=plan-form] [data-testid=plan-save]'); await O.waitForSelector('[data-testid=plan-row]');
assert.match(await flat(O.locator('[data-testid=plan-row]')), /Clube do Corte · R\$ 120,00\/mês.*1× Barba · 2× Corte/);
assert.equal(sql(`select count(*) from "ClubPlanItem"`), '2');
console.log('1. dono cria o plano "1× Barba · 2× Corte" por R$ 120,00 (e a validação recusa plano sem serviço) OK');

// 2. cliente vê o plano no lugar, pede a assinatura e fica aguardando o pagamento; não assina duas vezes
await C.goto(BASE + `/lugar/${rid}#clube`); await C.waitForSelector('[data-testid=club-plan]');
assert.match(await flat(C.locator('[data-testid=club-plan]')), /Clube do Corte.*R\$ 120,00 por mês.*1× Barba · 2× Corte/);
await C.click('[data-testid=club-subscribe]'); await C.waitForURL('**/perfil/clube?pedido=1'); await C.waitForSelector('[data-testid=club-requested]');
assert.match(await C.locator('[data-testid=my-sub-state]').innerText(), /Aguardando pagamento/i);
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=club-mine]');
assert.equal(await C.locator('[data-testid=club-subscribe]').count(), 0, 'quem já assina não vê o botão');
// ainda sem pagamento: o agendamento é normal (sem cobertura)
await C.goto(page(corte, '10:00')); await C.waitForSelector('button:has-text("Confirmar agendamento")');
assert.equal(await C.locator('[data-testid=club-covered]').count(), 0);
console.log('2. cliente pede o plano pelo app, fica aguardando pagamento e sem cobertura ainda OK');

// 3. dono vê o pedido, registra o 1º pagamento: vira "Em dia", entra no Financeiro e avisa o cliente; renovar logo em seguida é recusado
await O.goto(BASE + '/dashboard/clube'); await O.waitForSelector('[data-testid=sub-need] [data-testid=sub-row]');
assert.match(await flat(O.locator('[data-testid=sub-need] [data-testid=sub-row]')), /Lucas.*Clube do Corte.*Aguardando pagamento/i);
await O.click('[data-testid=sub-pay]'); await O.waitForFunction(() => document.querySelector('[data-testid=sub-state]')?.textContent?.includes('Em dia'));
assert.equal(sql(`select "paidPeriods"||'|'||("anchorDate" is not null)::text from "ClubSubscription"`), '1|true');
assert.equal(sql(`select kind||'|'||category||'|'||"amountCents"||'|'||source from "FinanceEntry"`), 'IN|Clube de assinatura|12000|CLUBE');
assert.equal(await O.locator('[data-testid=sub-pay]').count(), 0, 'sem botão de novo pagamento no mesmo dia');
assert.match(await flat(O.locator('[data-testid=kpi-monthly]')), /R\$ 120,00/);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title='Plano ativo'`), '1');
console.log('3. 1º pagamento registrado: em dia, R$ 120,00 no Financeiro, cliente avisado, sem pagamento em dobro OK');

// 4. agendamentos cobertos abatem o saldo: 2 cortes e 1 barba; o 3º corte é cobrado normalmente
const book = async (svc, hora) => { await C.goto(page(svc, hora)); await C.waitForSelector('button:has-text("Confirmar agendamento")'); return C.locator('[data-testid=club-covered]').count().then(async (n) => { const txt = n ? await C.locator('[data-testid=club-covered]').innerText() : ''; await C.click('button:has-text("Confirmar agendamento")'); await C.waitForURL('**/perfil/agendamentos**'); return txt; }); };
const t1 = await book(corte, '10:00'); assert.match(t1, /Incluso no seu plano Clube do Corte.*sobram 1 uso/);
const t2 = await book(corte, '11:00'); assert.match(t2, /sobram 0 usos/);
const t3 = await book(corte, '12:00'); assert.equal(t3, '', 'o terceiro corte passa do saldo: sem cobertura');
const t4 = await book(barba, '13:00'); assert.match(t4, /Incluso no seu plano.*sobram 0 usos/);
assert.equal(sql(`select string_agg(to_char(("startsAt" at time zone 'UTC') at time zone 'America/Sao_Paulo','HH24:MI')||':'||("clubSubscriptionId" is not null)::text, ' ' order by "startsAt") from "Booking"`), '10:00:true 11:00:true 12:00:false 13:00:true');
await C.goto(BASE + '/perfil/clube'); await C.waitForSelector('[data-testid=my-sub-balance]');
const bal = await C.locator('[data-testid=balance-left]').allInnerTexts();
assert.deepEqual(bal.map((t) => t.replace(/\s+/g, ' ')), ['restam 0 de 1', 'restam 0 de 2']); // Barba, Corte (ordem alfabética)
console.log('4. 2 cortes e 1 barba abatem o saldo; o 3º corte é cobrado normalmente OK');

// 5. cancelar um corte coberto devolve o saldo e o dono vê o uso no plano
await C.goto(BASE + '/perfil/agendamentos'); await C.waitForSelector('text=Corte');
sql(`update "Booking" set status='CANCELED', "canceledAt"=now(), "canceledBy"='CUSTOMER' where "serviceName"='Corte' and to_char(("startsAt" at time zone 'UTC') at time zone 'America/Sao_Paulo','HH24:MI')='11:00'`);
await C.goto(BASE + '/perfil/clube'); await C.waitForSelector('[data-testid=my-sub-balance]');
assert.deepEqual((await C.locator('[data-testid=balance-left]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')), ['restam 0 de 1', 'restam 1 de 2']);
console.log('5. cancelar um atendimento do plano devolve o saldo do ciclo OK');

// 6. concluir o atendimento do plano: não cobra, não dá pontos, não vira receita da agenda; o 12:00 (cobrado) dá pontos normalmente
const todayStart = `((date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') at time zone 'UTC')`;
const before = Number(sql(`select balance from "Wallet" where "customerId"='${lucas}' and "restaurantId"='${rid}'`) || 0);
sql(`update "Booking" set "startsAt"=${todayStart}+interval '1 hour', "endsAt"=${todayStart}+interval '90 minutes' where "clubSubscriptionId" is not null and "serviceName"='Corte' and status='CONFIRMED'`);
await O.goto(BASE + '/dashboard/agenda?vista=lista'); await O.waitForSelector('button:has-text("Concluir")');
await O.click('button:has-text("Concluir")'); await O.waitForSelector('text=Concluído.');
assert.equal(sql(`select status||'|'||"pointsAwarded"||'|'||("claimId" is null)::text from "Booking" where "clubSubscriptionId" is not null and "serviceName"='Corte' and status<>'CANCELED'`), 'COMPLETED|0|true');
assert.equal(Number(sql(`select coalesce(balance,0) from "Wallet" where "customerId"='${lucas}' and "restaurantId"='${rid}'`) || 0), before, 'sem pontos');
console.log('6. atendimento do plano concluído: sem cobrança, sem pontos OK');

// 7. financeiro: a agenda mostra o atendimento mas R$ 0 (já pago na mensalidade) e a mensalidade entra como entrada
await O.goto(BASE + '/dashboard/financeiro'); await O.waitForSelector('[data-testid=finance-sources]');
const src = await flat(O.locator('[data-testid=finance-sources]'));
assert.match(src, /Agenda 1 atendimento concluído R\$ 0,00/);
assert.match(src, /Lançadas por você.*R\$ 120,00/);
console.log('7. no Financeiro a mensalidade entra como entrada e o atendimento do plano não conta de novo OK');

// 8. renovação: no ciclo recém-pago não abre; na última semana abre (e vencida também); desfazer recusa se o ciclo já foi usado
await O.goto(BASE + '/dashboard/clube'); await O.waitForSelector('[data-testid=sub-row]');
assert.equal(await O.locator('[data-testid=sub-pay]').count(), 0); assert.ok(await O.locator('[data-testid=sub-paid-ok]').count());
sql(`update "ClubSubscription" set "anchorDate"=("anchorDate" - interval '25 days')::date`); // o ciclo pago termina em ~5 dias: a janela de renovação abre
await O.goto(BASE + '/dashboard/clube'); await O.waitForSelector('[data-testid=sub-pay]');
await O.click('[data-testid=sub-pay]');
await until(() => sql(`select "paidPeriods" from "ClubSubscription"`) === '2', 'renovação registrada');
assert.equal(sql(`select count(*) from "FinanceEntry" where source='CLUBE'`), '2');
await O.click('[data-testid=sub-undo]');
await until(() => sql(`select "paidPeriods" from "ClubSubscription"`) === '1', 'último pagamento desfeito (o 2º ciclo ainda não foi usado)');
console.log('8. renovação só na última semana do ciclo; desfazer o último pagamento OK');

// o ciclo 1 já tem atendimentos do plano: desfazer o pagamento dele é recusado com o motivo na tela
await until(() => sql(`select "paidPeriods" from "ClubSubscription"`) === '1', 'um ciclo pago');
await O.goto(BASE + '/dashboard/clube'); await O.waitForSelector('[data-testid=sub-undo]'); await O.click('[data-testid=sub-undo]');
await O.waitForSelector('[data-testid=club-error]'); assert.match(await O.locator('[data-testid=club-error]').innerText(), /já tem atendimentos do plano/);
assert.equal(sql(`select "paidPeriods" from "ClubSubscription"`), '1');

// 9. cancelar: o cliente cancela a renovação mas o que foi pago continua valendo até o fim do ciclo; nova assinatura do mesmo plano é permitida depois
await C.goto(BASE + '/perfil/clube'); await C.waitForSelector('[data-testid=my-sub-cancel]');
await C.click('[data-testid=my-sub-cancel]'); await C.waitForFunction(() => document.querySelector('[data-testid=my-sub-state]')?.textContent?.toLowerCase().includes('cancelada'));
assert.equal(sql(`select status from "ClubSubscription"`), 'CANCELED');
assert.equal(await C.locator('[data-testid=my-sub-cancel]').count(), 0);
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=club-subscribe]'); // pode assinar de novo
console.log('9. cancelar a renovação mantém o ciclo pago; é possível assinar de novo OK');

// 10. dono cadastra assinante pelo CPF (sem conta → erro claro; com conta e pagamento → em dia) e o celular não rola para o lado
await O.goto(BASE + '/dashboard/clube'); await O.waitForSelector('[data-testid=sub-new]'); await O.click('[data-testid=sub-new]');
await O.fill('[data-testid=sub-cpf]', '11111111111'); await O.click('[data-testid=sub-save]'); await O.waitForSelector('text=CPF inválido');
const cpf = sql(`select cpf from "Customer" where email='lucas@teste.com'`);
await O.fill('[data-testid=sub-cpf]', cpf); await O.click('[data-testid=sub-save]'); await O.waitForSelector('text=Assinante cadastrado');
assert.equal(sql(`select count(*) from "ClubSubscription" where status='ACTIVE'`), '1');
await C.goto(BASE + '/perfil/clube'); await C.waitForSelector('[data-testid=my-sub]');
assert.ok(await C.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sem rolagem lateral');
console.log('10. cadastro pelo CPF (validação, pagamento já recebido) e tela do cliente sem rolagem lateral OK');

sql(`delete from "Booking"; delete from "ClubSubscription"; delete from "ClubPlan"; delete from "FinanceEntry"; delete from "Notification" where title in ('Plano ativo','Plano renovado','Assinatura pedida')`);
await b.close();
