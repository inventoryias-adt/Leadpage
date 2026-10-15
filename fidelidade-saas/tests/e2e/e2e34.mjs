import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '18:00' })));
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const reset = (cat) => sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2, category=${cat ? `'${cat}'` : 'null'}, "categoryOther"=null where id='${rid}'; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; update "Unit" set "openingSchedule"='${week}'::jsonb`);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); await c.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); }); const p = await c.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); return p; };
const customerLogin = async (p) => { await p.goto(`${BASE}/entrar`); await p.fill('#c-email', 'lucas@teste.com'); await p.fill('#c-password', 'senha-cliente-1'); await p.click('button[type=submit]'); await p.waitForURL('**/carteira**'); };

// 1. barbearia já configurada, sem nenhum serviço cadastrado: o cliente vê "Agendar" e agenda
reset('barbearia');
assert.equal(sql(`select count(*) from "Service"`), '0');
const l = await mk(); await customerLogin(l);
await l.goto(`${BASE}/lugar/${rid}`); await l.waitForSelector('a:has-text("Agendar")');
assert.equal(sql(`select name||'|'||"durationMin"||'|'||"priceCents" from "Service"`), 'Atendimento|30|0', 'serviço padrão criado');
await l.click('a:has-text("Agendar")'); await l.waitForSelector('text=O que você quer marcar?'); await l.click('a:has-text("Atendimento")'); await l.waitForSelector('text=Escolha o dia');
await l.click('ul.chip-row li a:has-text("Amanhã")'); await l.waitForSelector('ul.chip-row a[aria-current=date]:has-text("Amanhã")'); await l.waitForSelector('text=Horários de');
await l.click('ul.grid a:has-text("10:00")'); await l.waitForSelector('button:has-text("Confirmar agendamento")'); await l.click('button:has-text("Confirmar agendamento")');
await l.waitForURL('**/perfil/agendamentos**'); await l.waitForSelector('text=Atendimento');
assert.equal(sql(`select status||'|'||"serviceName" from "Booking"`), 'CONFIRMED|Atendimento');
assert.equal(sql(`select count(*) from "Resource"`), '1');
console.log('1. barbearia sem serviços: aparece "Agendar" e o cliente agenda o serviço padrão sem escolher ninguém OK');

// 2. categoria sem hora marcada e sem serviços: não oferece agendamento
reset('pizza');
await l.goto(`${BASE}/lugar/${rid}`); await l.waitForSelector('h1');
assert.equal(await l.locator('a:has-text("Agendar")').count(), 0);
assert.equal(sql(`select count(*) from "Service"`), '0');
console.log('2. pizza sem serviços: não oferece agendamento OK');

// 3. o dono escolhe a categoria e o serviço padrão já nasce
reset(null);
const o = await b.newContext({ viewport: { width: 1200, height: 900 } }).then((c) => c.newPage());
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard**');
await o.goto(BASE + '/dashboard/configuracoes'); await o.waitForSelector('#i-cat'); await o.waitForTimeout(1500);
await o.selectOption('#i-cat', 'estetica'); await o.waitForSelector('text=✓ Categoria salva');
assert.equal(sql(`select name from "Service"`), 'Atendimento');
await l.goto(`${BASE}/lugar/${rid}`); await l.waitForSelector('a:has-text("Agendar")');
console.log('3. o dono escolhe "estética": o serviço padrão já existe e o cliente vê "Agendar" OK');
await b.close();
console.log('ALL OK (serviço padrão para quem atende com hora marcada)');
