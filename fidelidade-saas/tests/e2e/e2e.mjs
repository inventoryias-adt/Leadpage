import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000';
const sql = (q) => execSync(`psql postgresql://postgres:postgres@localhost:5432/fidelidade -At -c ${JSON.stringify(q)}`).toString().trim();
sql('TRUNCATE "Restaurant","Customer" CASCADE');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const shot = (page, name) => page.screenshot({ path: `${name}.png`, fullPage: true });

// ---------- Restaurante (desktop)
const rctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const r = await rctx.newPage();
r.on('console', (m) => { if (['error','warning'].includes(m.type())) console.log('R-CONSOLE', r.url(), m.text().slice(300,1500)); });
r.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await r.goto(BASE + '/');
await shot(r, 'landing');
await r.fill('#name', 'Burger do Zé');
await r.fill('#email', 'ze@burger.com');
await r.fill('#phone', '11912345678');
await r.fill('#password', 'senha-segura-1');
await r.click('text=Ir para pagamento seguro');
await r.waitForURL('**/pagamento/simulado');
await r.click('text=Simular pagamento');
await r.waitForURL('**/dashboard/configuracoes');
// o passo a passo abre sozinho depois do pagamento
await r.waitForSelector('[role=dialog]:has-text("Pagamento confirmado")');
assert.match(await r.locator('[role=dialog]').innerText(), /passo 1 de 11/i);
await r.click('[role=dialog] >> text=Próximo');
await r.waitForSelector('[role=dialog]:has-text("Identidade da marca")');
await shot(r, 'guia');
await r.click('[role=dialog] >> text=Pular guia');
await r.waitForSelector('[role=dialog]', { state: 'detached' });
assert.ok(sql('select "guideDoneAt" is not null from "Restaurant" limit 1') === 't');
console.log('1. signup + pagamento + guia inicial OK');

// dashboard bloqueado até concluir onboarding
await r.goto(BASE + '/dashboard/caixa');
await r.waitForURL('**/dashboard/configuracoes');

await r.click('button:has-text("Salvar nome")');
await r.waitForSelector('text=Dados salvos.');
// unidade principal: endereço + horários (preenche segunda, aplica a todos, ajusta sábado/domingo)
const U = 'form:has(input[name=id])';
await r.fill(`${U} input[name=street]`, 'Rua das Flores');
await r.fill(`${U} input[name=number]`, '100');
await r.fill(`${U} input[name=district]`, 'Centro');
await r.fill(`${U} input[name=city]`, 'São Paulo');
await r.selectOption(`${U} select[name=state]`, 'SP');
await r.fill(`${U} input[id$="o-1"]`, '09:00');
await r.fill(`${U} input[id$="c-1"]`, '23:00');
await r.click(`${U} button[aria-label^="Repetir o horário de Segunda"]`);
await r.fill(`${U} input[id$="o-6"]`, '11:00'); await r.fill(`${U} input[id$="c-6"]`, '00:00');
await r.fill(`${U} input[id$="o-0"]`, '11:00'); await r.fill(`${U} input[id$="c-0"]`, '00:00');
await r.check(`${U} li:has(span:text-is("Quarta-feira")) input[type=checkbox]`); // quarta fechada
await shot(r, 'horarios');
await r.click('button:has-text("Salvar unidade")');
await r.waitForSelector('text=Unidade salva.');
const saved = JSON.parse(sql(`select "openingSchedule" from "Unit"`));
assert.equal(saved.find(d => d.day === 2).open, '09:00');
assert.equal(saved.find(d => d.day === 5).close, '23:00');
assert.equal(saved.find(d => d.day === 3).closed, true);
assert.equal(saved.find(d => d.day === 6).open, '11:00');
// concluir sem produto deve falhar
await r.click('text=Concluir configuração');
await r.waitForSelector('text=Cadastre pelo menos um produto');
await r.fill('input[name=name][placeholder^="Ex.: Sobremesa"]', 'Sobremesa grátis');
await r.fill('input[name=pointsCost]', '500');
await r.click('text=Adicionar produto');
await r.waitForSelector('li:has-text("Sobremesa grátis")');
await r.fill('input[name=name][placeholder^="Ex.: Sobremesa"]', 'Combo Hambúrguer + Fritas');
await r.fill('input[name=pointsCost]', '1200');
await r.click('text=Adicionar produto');
await r.waitForSelector('li:has-text("Combo")');
await shot(r, 'config');
await r.click('text=Concluir configuração');
await r.waitForURL('**/dashboard/caixa');
console.log('2. onboarding OK');

// ---------- Caixa
await r.fill('#amount', '150,00');
await r.check('text=Avaliação 5 estrelas no Google');
await r.check('text=Foto no Instagram');
await r.waitForSelector('text=1.650 pts');
await r.click('text=Gerar QR Code');
await r.waitForSelector('svg[viewBox]:visible');
await r.waitForSelector('text=Enviar por WhatsApp');
await shot(r, 'caixa');
const token = sql('select token from "Claim" order by "createdAt" desc limit 1');
assert.equal(sql('select points from "Claim" order by "createdAt" desc limit 1'), '1650');
console.log('3. caixa OK, token', token.slice(0, 6) + '…');

// ---------- Cliente (mobile)
const cctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
const c = await cctx.newPage();
c.on('console', (m) => { if (['error','warning'].includes(m.type())) console.log('C-CONSOLE', c.url(), m.text().slice(300,1500)); });
c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(`${BASE}/r/${token}`);
await c.waitForSelector('text=Quando você pode vir resgatar');
await c.waitForSelector('text=Seg e Ter');
await c.waitForSelector('text=Sáb e Dom');
await shot(c, 'claim');
// GET não consome o QR
assert.equal(sql(`select count(*) from "Claim" where token='${token}' and "redeemedAt" is null`), '1');
await c.click('[role=tab]:has-text("Criar conta")');
await c.fill('#s-name', 'Lucas Silva');
await c.fill('#s-cpf', '111.111.111-11');
await c.fill('#s-phone', '11999998888');
await c.fill('#s-email', 'lucas@teste.com');
await c.fill('#s-password', 'senha-cliente-1');
await c.click('text=Receber meus pontos');
await c.waitForSelector('text=CPF inválido');
await c.fill('#s-cpf', '529.982.247-25');
await c.fill('#s-password', 'senha-cliente-1');
await c.click('text=Receber meus pontos');
await c.waitForURL('**/carteira/*?credited=1');
await c.waitForSelector('text=1.650');
await shot(c, 'wallet');
const walletUrl = c.url().split('?')[0];
console.log('4. cliente creditado OK');

// reuso do QR
await c.goto(`${BASE}/r/${token}`);
await c.waitForSelector('text=QR Code já utilizado');
console.log('5. QR de uso único OK');

// ---------- Resgate
await c.goto(walletUrl);
await c.click('button[aria-label="Resgatar Sobremesa grátis"]');
await c.click('text=Confirmar');
await c.waitForSelector('text=Resgate feito!');
assert.equal(sql('select balance from "Wallet"'), '1150');
const code = sql(`select code from "Redemption"`);
await c.reload();
await c.waitForSelector(`text=${code}`);
await shot(c, 'wallet-voucher');
console.log('6. resgate OK, código', code);

// limite mensal: a página ainda mostra o botão ativo, mas o servidor recusa
await c.reload();
sql(`update "Restaurant" set "maxRedeemsPerMonth"=1`);
await c.click('button[aria-label="Resgatar Sobremesa grátis"]');
await c.click('text=Confirmar');
await c.waitForSelector('text=Limite de 1 resgates');
assert.equal(sql('select balance from "Wallet"'), '1150');
assert.equal(sql('select count(*) from "Redemption"'), '1');
await c.reload();
await c.waitForSelector('text=atingiu o limite');
assert.equal(await c.locator('button[aria-label="Resgatar Sobremesa grátis"]').isDisabled(), true);
sql(`update "Restaurant" set "maxRedeemsPerMonth"=5`);
console.log('7. limite mensal OK (servidor + UI)');

// ---------- Balcão valida
await r.goto(BASE + '/dashboard/resgates');
await r.waitForSelector(`text=${code}`);
await shot(r, 'resgates');
await r.click('button:has-text("Entregar")');
await r.waitForSelector('text=Nenhum prêmio para entregar');
assert.equal(sql(`select status from "Redemption"`), 'USED');
console.log('8. validação no balcão OK');

// ---------- Dono vê clientes e histórico
await r.goto(BASE + '/dashboard');
await r.click('text=Clientes na carteira');
await r.waitForURL('**/dashboard/clientes');
await r.waitForSelector('text=Lucas Silva');
await shot(r, 'clientes');
await r.fill('input[name=q]', '529982'); await r.click('button:has-text("Buscar")');
await r.waitForSelector('text=Lucas Silva');
await r.fill('input[name=q]', 'zzz'); await r.click('button:has-text("Buscar")');
await r.waitForSelector('text=Nenhum cliente encontrado');
await r.goto(BASE + '/dashboard/clientes');
await r.click('text=Lucas Silva');
await r.waitForURL('**/dashboard/clientes/*');
await r.waitForSelector('text=Histórico de pontos');
await r.waitForSelector('text=Compra de R$ 150,00');
await r.waitForSelector('text=+1.650');
await r.waitForSelector('text=Sobremesa grátis');
await r.waitForSelector('text=Entregue');
await shot(r, 'cliente-detalhe');
await r.goto(BASE + '/dashboard');
await r.click('a.card-link:has-text("Pontos emitidos")');
await r.waitForURL('**/dashboard/pontos');
await r.waitForSelector('text=Quem recebeu pontos');
await r.waitForSelector('a:has-text("Lucas Silva")');
await r.waitForSelector('text=+1.650');
await shot(r, 'pontos');
await r.goto(BASE + '/dashboard');
await r.click('a.card-link:has-text("a entregar")');
await r.waitForSelector('text=Resgates do mês');
await r.waitForSelector('text=1 resgate · 500 pts usados');
// segurança: cliente de outro restaurante não aparece
await r.goto(BASE + '/dashboard/clientes/00000000-0000-0000-0000-000000000000');
await r.waitForSelector('text=Página não encontrada');
assert.equal(await r.locator('text=Histórico de pontos').count(), 0);
console.log('8b. visão do dono por cliente OK');
await r.goto(BASE + '/dashboard');

// login restaurante / logout
await r.click('text=Sair');
await r.waitForURL('**/login');
await r.fill('#email', 'ze@burger.com');
await r.fill('#password', 'errada');
await r.click('button:has-text("Entrar")');
await r.waitForSelector('text=E-mail ou senha incorretos.');
await r.fill('#password', 'senha-segura-1');
await r.click('button:has-text("Entrar")');
await r.waitForURL('**/dashboard');
await shot(r, 'home');
console.log('9. login OK');

// dashboard mobile
const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2, storageState: await rctx.storageState() })).newPage();
await m.goto(BASE + '/dashboard/caixa');
await shot(m, 'caixa-mobile');
await browser.close();
console.log('ALL OK');
