// O dono marca horários (encaixe, com e sem conta), bloqueia folgas e define intervalo entre atendimentos:
// tudo isso muda os horários que o cliente vê, e nada permite marcar em cima de outro horário.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '18:00' })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=60,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2,"bookingBufferMin"=0; delete from "TimeOff"; delete from "SlotHold"; delete from "Notification"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; update "Unit" set "openingSchedule"='${week}'::jsonb`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','Ana',1)`);
sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','Bia',1)`);
const sid = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','Corte',30,5000) returning id`).split('\n')[0];
const lucasCpf = sql(`select cpf from "Customer" where email='lucas@teste.com'`);
const br = new Date(Date.now() - 3 * 3600e3); br.setUTCDate(br.getUTCDate() + 1);
const day = br.toISOString().slice(0, 10);
const [yy, mm, dd] = day.split('-');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (view = { width: 1100, height: 1000 }) => {
  const ctx = await b.newContext({ viewport: view });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return p;
};
const O = await mk();
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
const C = await mk({ width: 390, height: 844 });
await C.goto(BASE + '/entrar'); await C.fill('#c-email', 'lucas@teste.com'); await C.fill('#c-password', 'senha-cliente-1'); await C.click('button[type=submit]'); await C.waitForURL('**/carteira**');
const clientTimes = async () => { await C.goto(`${BASE}/lugar/${rid}/agendar?servico=${sid}&data=${day}`); await C.waitForSelector('text=Escolha o dia'); await C.waitForTimeout(400); return (await C.locator('ul.grid a').allInnerTexts()).map((t) => t.trim()); };
const ownerPage = (q = '') => `${BASE}/dashboard/agenda/novo?servico=${sid}&data=${day}${q}`;
const ownerTimes = async () => { await O.goto(ownerPage()); await O.waitForSelector('[data-testid=ver-horarios]'); return (await O.locator('[data-testid=owner-slots] a').allInnerTexts()).map((t) => t.trim()); };

// 1. encaixe sem conta: nome e telefone
await O.goto(BASE + '/dashboard/agenda'); await O.waitForSelector('[data-testid=novo-agendamento]');
await O.click('[data-testid=novo-agendamento]'); await O.waitForURL('**/agenda/novo');
await O.goto(ownerPage('&hora=10:00')); await O.waitForSelector('[data-testid=owner-booking-form]');
await O.fill('#ob-name', 'Carlos Souza'); await O.fill('#ob-phone', '11988887777');
await O.click('button:has-text("Marcar horário")'); await O.waitForURL('**/dashboard/agenda**'); await O.waitForSelector('[role=status]:has-text("Horário marcado")');
assert.equal(sql(`select coalesce("customerId",'-')||'|'||"guestName"||'|'||"guestPhone"||'|'||"createdBy"||'|'||status from "Booking"`), '-|Carlos Souza|11988887777|OWNER|CONFIRMED');
await O.goto(`${BASE}/dashboard/agenda?data=${day}&per=dia&vista=lista`); await O.waitForSelector('text=Carlos Souza'); assert.ok(await O.locator('text=encaixe').count());
console.log('1. encaixe de quem não tem conta (nome + telefone): confirmado, marcado como encaixe e visível na agenda OK');

// 2. encaixe com conta, pelo CPF: o cliente recebe o aviso
await O.goto(ownerPage('&hora=10:00')); await O.waitForSelector('[data-testid=owner-booking-form]');
await O.fill('#ob-cpf', lucasCpf); await O.click('button:has-text("Marcar horário")'); await O.waitForSelector('[role=status]:has-text("Horário marcado")');
assert.equal(sql(`select count(*) from "Booking" b join "Customer" c on c.id=b."customerId" where c.email='lucas@teste.com' and b."createdBy"='OWNER'`), '1');
assert.equal(sql(`select count(*) from "Notification" n join "Customer" c on c.id=n."customerId" where c.email='lucas@teste.com' and n.title='O lugar marcou um horário para você'`), '1');
console.log('2. encaixe com CPF: agendamento do cliente + aviso no app OK');

// 3. sem conflito: com as duas profissionais ocupadas às 10:00, ninguém (nem o dono, nem o cliente) vê o horário
assert.ok(!(await ownerTimes()).includes('10:00'), 'o dono não consegue marcar em cima');
assert.ok(!(await clientTimes()).includes('10:00'), 'o cliente também não vê');
// CPF que não existe e dados faltando dão aviso claro
await O.goto(ownerPage('&hora=11:00')); await O.waitForSelector('[data-testid=owner-booking-form]');
await O.fill('#ob-cpf', '39053344705'); await O.click('button:has-text("Marcar horário")'); await O.waitForSelector('[role=alert]:has-text("Nenhum cliente com esse CPF")');
await O.fill('#ob-cpf', ''); await O.click('button:has-text("Marcar horário")'); await O.waitForSelector('[role=alert]:has-text("CPF do cliente ou o nome")');
assert.equal(sql(`select count(*) from "Booking"`), '2');
console.log('3. horário ocupado some para todos e dados inválidos recebem aviso claro OK');

// 4. folga de todos (14:00–16:00): some para o cliente; remover devolve
await O.goto(BASE + '/dashboard/agenda/folgas'); await O.waitForSelector('[data-testid=timeoff-form]');
await O.fill('#to-reason', 'Reunião'); await O.fill('#to-start', day); await O.fill('#to-from', '14:00'); await O.fill('#to-until', '16:00');
await O.click('button:has-text("Bloquear período")'); await O.waitForSelector('[role=status]:has-text("Bloqueio salvo")'); await O.waitForSelector('[data-testid=timeoff-list] :text("Reunião")');
let t = await clientTimes();
for (const h of ['14:00', '14:30', '15:00', '15:30']) assert.ok(!t.includes(h), `${h} bloqueado`);
assert.ok(t.includes('13:30') && t.includes('16:00'), 'as bordas continuam livres');
await O.goto(BASE + '/dashboard/agenda/folgas'); await O.click('[data-testid=timeoff-list] button:has-text("Remover")'); await O.waitForSelector('text=Nenhum bloqueio por enquanto');
assert.ok((await clientTimes()).includes('14:00'), 'removido: volta');
console.log('4. folga de todos esconde o período do cliente; remover devolve OK');

// 5. folga só da Ana: a Bia segue livre (o horário continua aparecendo); bloqueando as duas, some
await O.goto(BASE + '/dashboard/agenda/folgas'); await O.waitForSelector('[data-testid=timeoff-form]');
await O.selectOption('#to-who', { label: 'Ana' }); await O.fill('#to-start', day); await O.fill('#to-from', '12:00'); await O.fill('#to-until', '13:00');
await O.click('button:has-text("Bloquear período")'); await O.waitForSelector('[role=status]:has-text("Bloqueio salvo")');
assert.ok((await clientTimes()).includes('12:00'), 'Bia atende');
await O.selectOption('#to-who', { label: 'Bia' }); await O.fill('#to-start', day); await O.fill('#to-from', '12:00'); await O.fill('#to-until', '13:00');
await O.click('button:has-text("Bloquear período")'); await O.waitForSelector('[role=status]:has-text("Bloqueio salvo")');
assert.ok(!(await clientTimes()).includes('12:00'), 'as duas em folga: some');
sql(`delete from "TimeOff"`);
console.log('5. folga de um profissional só fecha o horário quando todos os que atendem estão fora OK');

// 6. folga em cima de horário já marcado: avisa, não cancela
await O.goto(BASE + '/dashboard/agenda/folgas'); await O.waitForSelector('[data-testid=timeoff-form]');
await O.fill('#to-start', day); await O.fill('#to-from', '09:30'); await O.fill('#to-until', '10:15');
await O.click('button:has-text("Bloquear período")'); await O.waitForSelector('[role=status]:has-text("2 agendamentos já marcados")');
assert.equal(sql(`select count(*) from "Booking" where status='CONFIRMED'`), '2');
sql(`delete from "TimeOff"`);
console.log('6. bloqueio sobre horários já marcados avisa e não cancela nada OK');

// 7. intervalo entre atendimentos: vizinhos dos 10:00 fecham
sql(`update "Restaurant" set "bookingBufferMin"=15`);
t = await clientTimes();
assert.ok(!t.includes('09:30') && !t.includes('10:30'), `vizinhos fechados com intervalo: ${t}`);
assert.ok(t.includes('09:00') && t.includes('11:00'));
sql(`update "Restaurant" set "bookingBufferMin"=0`);
assert.ok((await clientTimes()).includes('09:30'));
console.log('7. intervalo entre atendimentos fecha os horários vizinhos OK');

// 8. concluir o encaixe sem conta não quebra e não credita pontos
await O.goto(`${BASE}/dashboard/agenda?data=${day}&per=dia&vista=lista`); await O.waitForSelector('text=Carlos Souza');
await O.click('button[aria-label="Concluir: Corte de Carlos Souza"]'); await O.waitForSelector('[role=status]:has-text("Concluído")');
assert.equal(sql(`select status||'|'||"pointsAwarded" from "Booking" where "guestName"='Carlos Souza'`), 'COMPLETED|0');
console.log('8. concluir encaixe sem conta funciona e não credita pontos OK');

await b.close();
console.log('ALL OK (encaixe, folgas e intervalo)');
