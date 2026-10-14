import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '18:00' })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2; delete from "Booking"; delete from "Service"; delete from "Resource"; update "Unit" set "openingSchedule"='${week}'::jsonb`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
// um serviço e NENHUM profissional/vaga cadastrado (como se a vaga padrão tivesse sido removida)
sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Corte masculino',60,5000)`);
assert.equal(sql(`select count(*) from "Resource"`), '0');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const l = await ctx.newPage(); l.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await l.goto(`${BASE}/entrar`); await l.fill('#c-email', 'lucas@teste.com'); await l.fill('#c-password', 'senha-cliente-1'); await l.click('button[type=submit]'); await l.waitForURL('**/carteira**');

// 1. o cliente agenda normalmente: há horários, nenhuma escolha de profissional
await l.goto(`${BASE}/lugar/${rid}`); await l.waitForSelector('a:has-text("Agendar")');
await l.click('a:has-text("Agendar")'); await l.click('a:has-text("Corte masculino")'); await l.waitForSelector('text=Escolha o dia');
await l.click('ul.chip-row li a:has-text("Amanhã")'); await l.waitForSelector('ul.chip-row a[aria-current=date]:has-text("Amanhã")'); await l.waitForSelector('text=Horários de');
assert.equal(await l.locator('text=Com quem').count(), 0, 'sem escolha de profissional');
assert.equal(await l.locator('text=Atendimento').count(), 0, 'o atendente padrão não aparece como "profissional"');
assert.ok(await l.locator('ul.grid a:has-text("10:00")').count(), 'há horários');
assert.equal(sql(`select count(*)||'|'||min(name)||'|'||min(capacity) from "Resource"`), '1|Atendimento|1', 'a vaga única foi criada sozinha');
console.log('1. sem profissionais: o cliente vê os horários e não precisa escolher ninguém (vaga única criada sozinha) OK');

// 2. e consegue confirmar; o horário ocupado some (um atendente só)
await l.click('ul.grid a:has-text("10:00")'); await l.waitForSelector('button:has-text("Confirmar agendamento")');
await l.click('button:has-text("Confirmar agendamento")'); await l.waitForURL('**/perfil/agendamentos**'); await l.waitForSelector('text=Corte masculino');
assert.equal(sql(`select status from "Booking"`), 'CONFIRMED');
await l.goto(`${BASE}/lugar/${rid}`); await l.click('a:has-text("Agendar")'); await l.click('a:has-text("Corte masculino")');
await l.click('ul.chip-row li a:has-text("Amanhã")'); await l.waitForSelector('ul.chip-row a[aria-current=date]:has-text("Amanhã")'); await l.waitForSelector('text=Horários de');
assert.equal(await l.locator('ul.grid a:has-text("10:00")').count(), 0, 'com um atendente só, o horário ocupado some');
assert.equal(sql(`select count(*) from "Resource"`), '1', 'continua uma vaga só');
console.log('2. agenda e confirma; o horário ocupado some para os outros (um atendente só) OK');
await b.close();
console.log('ALL OK (sem funcionários: um atendente só)');
