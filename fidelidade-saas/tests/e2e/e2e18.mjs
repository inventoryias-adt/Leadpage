import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(); delete from "Booking"; delete from "Service"; delete from "Resource"`);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('#agenda');

// serviço com preço (cria a vaga padrão sozinho)
await o.fill('#sv-name', 'Corte masculino'); await o.fill('#sv-dur', '30'); await o.fill('#sv-price', '45,00');
await o.click('#agenda button:has-text("Adicionar serviço")'); await o.waitForSelector('#agenda >> text=Corte masculino');
assert.equal(sql(`select name||'|'||"durationMin"||'|'||"priceCents" from "Service"`), 'Corte masculino|30|4500');
assert.equal(sql(`select name||'|'||capacity from "Resource"`), 'Atendimento|1', 'vaga padrão criada junto com o 1º serviço');
// validações
await o.fill('#sv-name', 'X'); await o.fill('#sv-dur', '30'); await o.click('#agenda button:has-text("Adicionar serviço")');
await o.waitForSelector('#agenda >> text=Informe o nome do serviço');
await o.fill('#sv-name', 'Ruim'); await o.fill('#sv-dur', '2'); await o.click('#agenda button:has-text("Adicionar serviço")'); // 2 < min do input: o navegador barra
assert.equal(sql(`select count(*) from "Service"`), '1');
// serviço de reserva de mesa (sem profissional fixo: qualquer vaga)
await o.reload(); await o.waitForSelector('#agenda');
await o.fill('#sv-name', 'Reserva de mesa'); await o.fill('#sv-dur', '90'); await o.check('input[name=askPartySize]');
await o.click('#agenda button:has-text("Adicionar serviço")'); await o.waitForSelector('#agenda >> text=reserva de mesa');
const askSql = `select "askPartySize"::text from "Service" where name='Reserva de mesa'`;
for (let i = 0; i < 40 && sql(askSql) === ''; i++) await o.waitForTimeout(500); // o texto "reserva de mesa" já existe na página: espera gravar
assert.equal(sql(askSql), 'true');
// regras
await o.selectOption('#ag-notice', '120'); await o.selectOption('#ag-ahead', '14'); await o.selectOption('#ag-cancel', '24'); await o.uncheck('input[name=bookingAutoConfirm]');
await o.click('#agenda button:has-text("Salvar regras")'); await o.waitForSelector('#agenda >> text=Regras de agendamento salvas.');
assert.equal(sql(`select "bookingAutoConfirm"::text||'|'||"bookingMinNoticeMin"||'|'||"bookingMaxDaysAhead"||'|'||"bookingCancelHours" from "Restaurant" where email='ze@burger.com'`), 'false|120|14|24');
await o.screenshot({ path: 'ag-config.png', fullPage: true });
// remover (sem agendamentos: apaga)
await o.click('#agenda li:has-text("Reserva de mesa") >> button[aria-label^="Remover"]'); await o.waitForSelector('#agenda li:has-text("Reserva de mesa")', { state: 'detached' });
assert.equal(sql(`select count(*) from "Service" where name='Reserva de mesa'`), '0');
// de volta ao padrão para os próximos testes
sql(`update "Restaurant" set "bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2`);
await b.close();
console.log('ALL OK (agenda: cadastro)');
