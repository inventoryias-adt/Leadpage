import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(); delete from "Notification"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`delete from "InteractionClaim"; delete from "InteractionRule" where "restaurantId"='${rid}'; delete from "Wallet" where "customerId"='${cid}'`);
sql(`insert into "InteractionRule" (id,"restaurantId",label,points,approval) values ('r-manual','${rid}','Avaliar no Google',50,'MANUAL'),('r-auto','${rid}','Story no Instagram',30,'AUTO'),('r-balcao','${rid}','Indicar um amigo no balcão',20,'COUNTER')`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
const balance = () => Number(sql(`select coalesce(sum(balance),0) from "Wallet" where "customerId"='${cid}' and "restaurantId"='${rid}'`));

// 1. só as interações com aprovação mostram "Já fiz"; a do balcão segue igual
await c.goto(`${BASE}/lugar/${rid}`); await c.waitForSelector('text=Ações para ganhar pontos');
assert.equal(await c.locator('button:has-text("Já fiz")').count(), 2, 'dois botões Já fiz');
assert.ok(await c.locator('text=Faça e mostre ao caixa para receber os pontos.').count(), 'a do balcão continua pedindo para mostrar ao caixa');
console.log('1. Já fiz só nas interações com aprovação OK');

// 2. pedido manual: fica pendente e não credita
await c.locator('li:has-text("Avaliar no Google") button:has-text("Já fiz")').click();
await c.waitForSelector('[data-testid=claim-pending]');
assert.equal(sql(`select status from "InteractionClaim" where "ruleId"='r-manual'`), 'PENDING');
assert.equal(balance(), 0);
await c.reload(); await c.waitForSelector('[data-testid=claim-pending]');
assert.equal(await c.locator('li:has-text("Avaliar no Google") button:has-text("Já fiz")').count(), 0, 'sem botão enquanto pendente');
console.log('2. pedido manual pendente, sem pontos e sem repetir OK');

// 3. o dono vê o pedido no Caixa (com bolinha no menu) e aprova: +50 e aviso ao cliente
await o.goto(BASE + '/dashboard/caixa'); await o.waitForSelector('[data-testid=interaction-requests]');
assert.ok(await o.locator('[data-testid=interaction-requests] :text("Avaliar no Google")').count());
await o.locator('button[aria-label^="Aprovar: Avaliar no Google"]').click();
await o.waitForFunction(() => !document.querySelector('[data-testid=interaction-requests]'));
assert.equal(balance(), 50);
assert.equal(sql(`select status||'|'||"decidedBy" from "InteractionClaim" where "ruleId"='r-manual'`), 'APPROVED|OWNER');
assert.equal(sql(`select count(*) from "Transaction" t join "Wallet" w on w.id=t."walletId" where w."customerId"='${cid}' and t.description='Avaliar no Google'`), '1');
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}'`), '1');
console.log('3. dono aprova: carteira +50, extrato e aviso OK');

// 4. depois de aprovada, não dá para pedir de novo (30 dias)
await c.goto(`${BASE}/lugar/${rid}`); await c.waitForSelector('text=Pontos recebidos');
assert.equal(await c.locator('li:has-text("Avaliar no Google") button:has-text("Já fiz")').count(), 0);
console.log('4. depois de aprovada não repete dentro de 30 dias OK');

// 5. automático: pendente com prazo; antes do prazo não credita; passado o prazo entra sozinho ao abrir a tela
await c.locator('li:has-text("Story no Instagram") button:has-text("Já fiz")').click();
await c.waitForSelector('[data-testid=claim-pending]:has-text("libera em")');
assert.equal(sql(`select (status='PENDING' and "autoAt" > now() + interval '23 hours')::text from "InteractionClaim" where "ruleId"='r-auto'`), 'true');
assert.equal(balance(), 50);
sql(`update "InteractionClaim" set "autoAt"=now()-interval '1 minute' where "ruleId"='r-auto'`);
await c.goto(`${BASE}/lugar/${rid}`); await c.waitForSelector('text=Pontos recebidos');
assert.equal(balance(), 80);
assert.equal(sql(`select status||'|'||"decidedBy" from "InteractionClaim" where "ruleId"='r-auto'`), 'APPROVED|AUTO');
console.log('5. automático: entra sozinho no prazo (+30) OK');

// 6. automático que o dono recusa antes do prazo: nada entra e o cliente é avisado
sql(`delete from "InteractionClaim" where "ruleId"='r-auto'`);
await c.goto(`${BASE}/lugar/${rid}`);
await c.waitForSelector('button[aria-expanded="true"]:has-text("jeitos de ganhar")'); // a seção abre depois da hidratação; o clique espera ela abrir
await c.locator('li:has-text("Story no Instagram") button:has-text("Já fiz")').click(); await c.waitForSelector('[data-testid=claim-pending]');
await o.goto(BASE + '/dashboard/caixa'); await o.waitForSelector('[data-testid=interaction-requests]');
assert.ok(await o.locator('text=/libera em/').count(), 'mostra quando libera sozinho');
await o.locator('button[aria-label^="Recusar: Story no Instagram"]').click();
await o.waitForFunction(() => !document.querySelector('[data-testid=interaction-requests]'));
assert.equal(sql(`select status from "InteractionClaim" where "ruleId"='r-auto'`), 'REJECTED');
assert.equal(balance(), 80);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${cid}' and title='Não conseguimos confirmar'`), '1');
await c.goto(`${BASE}/lugar/${rid}`); await c.waitForSelector('text=não foi confirmado');
assert.equal(await c.locator('li:has-text("Story no Instagram") button:has-text("Já fiz")').count(), 1, 'depois de recusado, pode pedir de novo');
console.log('6. recusa: sem pontos, cliente avisado e pode tentar de novo OK');

// 7. decisão repetida não credita duas vezes
sql(`delete from "InteractionClaim"; delete from "Wallet" where "customerId"='${cid}'`);
await c.goto(`${BASE}/lugar/${rid}`);
await c.locator('li:has-text("Avaliar no Google") button:has-text("Já fiz")').click(); await c.waitForSelector('[data-testid=claim-pending]');
await o.goto(BASE + '/dashboard/caixa'); await o.waitForSelector('[data-testid=interaction-requests]');
const o2 = await ctx.newPage();
await o2.goto(BASE + '/dashboard/caixa'); await o2.waitForSelector('[data-testid=interaction-requests]');
await Promise.all([o.locator('button[aria-label^="Aprovar: Avaliar no Google"]').click(), o2.locator('button[aria-label^="Aprovar: Avaliar no Google"]').click()]);
await o.waitForTimeout(1500);
assert.equal(balance(), 50, 'duas aprovações ao mesmo tempo creditam uma vez só');
console.log('7. dupla aprovação credita uma vez só OK');

// 8. configuração: o dono troca o modo de confirmação
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('[data-testid=interaction-row]');
await o.locator('button[aria-label="Editar Indicar um amigo no balcão"]').click();
await o.selectOption('select[name=approval] >> nth=0', 'MANUAL');
await o.locator('form:has(select[name=approval]) button:has-text("Salvar")').first().click();
await o.waitForSelector('li:has-text("Indicar um amigo no balcão") :text("Você aprova")');
assert.equal(sql(`select approval from "InteractionRule" where id='r-balcao'`), 'MANUAL');
console.log('8. dono muda o modo de confirmação OK');

await b.close();
console.log('ALL OK (Já fiz com aprovação)');
