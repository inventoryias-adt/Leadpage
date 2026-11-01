// Agenda do dono mais direta: no alto só "Novo" e "Mais" (folgas, ocupação, regras, WhatsApp e planilha ficam no menu), pedidos aguardando em lista enxuta,
// "próximo atendimento" em destaque, filtros e chave Calendário/Lista na mesma faixa, e um dia vazio com ações em vez de só um aviso.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; delete from "Review"; delete from "Notification"; delete from "Booking"; update "Restaurant" set "guideDoneAt"=now()`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const hourBr = Number(sql(`select extract(hour from now() at time zone 'America/Sao_Paulo')::int`));
const ins = (startExpr, mins, status, name) => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","startsAt","endsAt",status,"serviceName","durationMin","priceCents") values (gen_random_uuid()::text,'${rid}','${unit}','${lucas}',${startExpr},${startExpr}+interval '${mins} minutes','${status}','${name}',${mins},5000) returning id`).split('\n')[0];
// amanhã às 10h, aguardando (outro dia); e, se ainda der para caber no mesmo dia, um atendimento daqui a 10 minutos
const tomorrow = ins(`(((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day 10 hours') at time zone 'America/Sao_Paulo') at time zone 'UTC')`, 30, 'PENDING', 'Corte amanhã');
const hasNext = hourBr < 23;
if (hasNext) ins(`now() + interval '10 minutes'`, 30, 'CONFIRMED', 'Barba agora');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const o = await ctx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
const noOverflow = async (what) => assert.ok(await o.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${what}: sem rolagem lateral`);

// 1. o alto da tela só tem "Novo" e "Mais"; as ferramentas ficam no menu
await o.goto(BASE + '/dashboard/agenda'); await o.waitForSelector('[data-testid=novo-agendamento]');
assert.ok(await o.locator('[data-testid=agenda-mais]').isVisible());
assert.equal(await o.locator('[data-testid=folgas]').isVisible(), false, 'folgas só dentro do menu');
assert.equal(await o.locator('[data-testid=ocupacao]').isVisible(), false);
assert.equal(await o.locator('[data-testid=whatsapp-abrir]').isVisible(), false);
await o.click('[data-testid=agenda-mais]');
for (const t of ['folgas', 'ocupacao', 'whatsapp-abrir', 'agenda-csv']) assert.ok(await o.locator(`[data-testid=${t}]`).isVisible(), `${t} aparece no menu`);
await noOverflow('menu aberto');
await o.screenshot({ path: 'agenda-menu.png' });
await o.click('[data-testid=ocupacao]'); await o.waitForURL('**/agenda/ocupacao');
console.log('1. no alto só Novo e Mais; folgas, ocupação, WhatsApp e planilha ficam no menu OK');

// 2. pedido de outro dia: bloco enxuto com Confirmar, Cancelar e Detalhes
await o.goto(BASE + '/dashboard/agenda'); await o.waitForSelector('[data-testid=pendentes]');
assert.match(await o.locator('[data-testid=pendentes] h2').innerText(), /Aguardando a sua confirmação \(1\)/i);
const row = o.locator('[data-testid=pendente]').first();
assert.ok(await row.locator('button:has-text("Confirmar")').isVisible() && await row.locator('button:has-text("Cancelar")').isVisible());
await row.locator('a:has-text("Detalhes")').click(); await o.waitForSelector('[data-testid=booking-modal]');
await o.goto(BASE + '/dashboard/agenda');
console.log('2. pedido de outro dia vira uma linha enxuta com Confirmar, Cancelar e Detalhes OK');

// 3. próximo atendimento em destaque
if (hasNext) {
  await o.waitForSelector('[data-testid=proximo-atendimento]');
  const t = await o.locator('[data-testid=proximo-atendimento]').innerText();
  assert.match(t, /próximo atendimento|em atendimento agora/i); assert.match(t, /Barba agora/);
  await o.locator('[data-testid=proximo-atendimento]').click(); await o.waitForSelector('[data-testid=booking-modal]');
  console.log('3. o próximo atendimento aparece em destaque e abre os detalhes OK');
  await o.goto(BASE + '/dashboard/agenda');
} else console.log('3. (pulado: depois das 23h o próximo atendimento cai no dia seguinte)');

// 4. período, atendente e chave Calendário/Lista na mesma faixa, depois da navegação de data
const nav = await o.locator('nav[aria-label="Período"]').boundingBox();
const fil = await o.locator('[data-testid=agenda-filtros]').boundingBox();
const vis = await o.locator('[data-testid=vista-grade]').boundingBox();
assert.ok(fil.y > nav.y, 'filtros abaixo da navegação de data');
assert.ok(Math.abs(vis.y - fil.y) < 160, 'a chave Calendário/Lista fica logo junto dos filtros');
await noOverflow('agenda');
await o.screenshot({ path: 'agenda-topo.png' });
console.log('4. filtros e chave Calendário/Lista na mesma faixa, com a navegação de data antes OK');

// 5. dia vazio com ações
await o.goto(BASE + '/dashboard/agenda?data=2027-03-10'); await o.waitForSelector('[data-testid=agenda-vazia]');
assert.ok(await o.locator('[data-testid=agenda-vazia] a:has-text("Novo agendamento")').isVisible());
assert.ok(await o.locator('[data-testid=agenda-vazia] a:has-text("Ver o próximo dia")').isVisible());
console.log('5. dia sem agendamentos mostra Novo agendamento e Ver o próximo dia OK');

// 6. confirmar o pedido de amanhã pelo bloco
await o.goto(BASE + '/dashboard/agenda'); await o.waitForSelector('[data-testid=pendentes]');
await o.locator('[data-testid=pendente] button:has-text("Confirmar")').first().click();
await o.waitForSelector('[data-testid=pendentes]', { state: 'detached' });
assert.equal(sql(`select status from "Booking" where id='${tomorrow}'`), 'CONFIRMED');
console.log('6. confirmar pelo bloco funciona e o bloco some OK');

await b.close();
console.log('ALL OK (agenda do dono mais direta)');
