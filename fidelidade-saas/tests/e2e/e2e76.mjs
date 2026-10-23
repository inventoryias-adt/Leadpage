// Painel do gestor mais claro: "‹ Início" nas telas internas, bloco Mensagens/Avaliações/Indicações no alto do Início (com número de novidades),
// Avaliações com abas separadas (atendimentos × indicações em fotos, cada uma com a sua nota); no app do cliente, o convite
// "Como foi o atendimento?" aparece quando o lugar conclui o atendimento e leva à avaliação já com a nota tocada.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const PHOTO = readFileSync(fileURLToPath(new URL('./fixtures/prato.png', import.meta.url)));
sql(`truncate "RateLimit"; delete from "Review"; delete from "Notification"; delete from "ChatMessage"; delete from "Conversation"; delete from "PostReport"; delete from "PostLike"; delete from "PostPhoto"; delete from "Post"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const todayStart = `((date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') at time zone 'UTC')`;
const booking = (h, status) => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","completedAt") values (gen_random_uuid()::text,'${rid}','${unit}','${lucas}',${todayStart}+interval '${h} hour',${todayStart}+interval '${h} hour 30 minutes','${status}','Corte',30,5000,${status === 'COMPLETED' ? 'now()' : 'null'}) returning id`).split('\n')[0];
// dados: 2 avaliações de atendimento, 1 indicação com foto, 1 conversa com mensagem do cliente não lida
const b1 = booking(1, 'COMPLETED'), b2 = booking(2, 'COMPLETED');
sql(`insert into "Review"(id,"restaurantId","customerId","bookingId","placeRating") values (gen_random_uuid()::text,'${rid}','${lucas}','${b1}',5)`);
const post = sql(`insert into "Post"(id,"customerId","restaurantId",rating,comment) values (gen_random_uuid()::text,'${lucas}','${rid}',3,'Bom, mas demorou') returning id`).split('\n')[0];
sql(`insert into "PostPhoto"("postId",mime,data) values ('${post}','image/png', decode('${PHOTO.toString('hex')}','hex'))`);
const conv = sql(`insert into "Conversation"(id,"customerId","restaurantId") values (gen_random_uuid()::text,'${lucas}','${rid}') returning id`).split('\n')[0];
sql(`insert into "ChatMessage"(id,"conversationId",sender,body) values (gen_random_uuid()::text,'${conv}','CUSTOMER','Oi, tem horário hoje?')`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (view, mobile) => {
  const ctx = await b.newContext({ viewport: view, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return p;
};
const O = await mk({ width: 390, height: 844 }, true);
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');

// 1. Início: o bloco de interações fica no alto, antes dos números, com as novidades à vista
await O.waitForSelector('[data-testid=inbox-hub]');
const hub = await O.locator('[data-testid=inbox-hub]').boundingBox();
const kpi = await O.locator('[data-testid=kpi-faixa]').boundingBox();
assert.ok(hub.y < kpi.y, 'bloco de interações vem antes dos números');
assert.ok(hub.y + hub.height < 700, 'aparece na primeira tela do celular');
assert.equal((await O.locator('[data-testid=chats-badge]').innerText()).trim(), '1');
assert.match(await O.locator('[data-testid=reviews-shortcut]').innerText(), /★ 5,0/);
assert.match(await O.locator('[data-testid=posts-shortcut]').innerText(), /1 foto/);
await O.screenshot({ path: 'owner-inicio-hub.png' });
console.log('1. Mensagens, Avaliações e Indicações ficam no alto do Início, com o número de novidades OK');

// 2. telas internas têm "‹ Início" (e o chat, "‹ Mensagens")
for (const [path, label] of [['/dashboard/mensagens', 'Início'], ['/dashboard/avaliacoes', 'Início'], ['/dashboard/indicacoes', 'Início'], ['/dashboard/clube', 'Início'], ['/dashboard/financeiro', 'Início']]) {
  await O.goto(BASE + path); await O.waitForSelector('[data-testid=owner-back]');
  assert.equal((await O.locator('[data-testid=owner-back]').first().innerText()).trim(), label, path);
}
await O.goto(BASE + '/dashboard/mensagens'); await O.click('[data-testid=owner-back]'); await O.waitForURL('**/dashboard');
await O.goto(BASE + `/dashboard/mensagens/${lucas}`); await O.waitForSelector('[data-testid=owner-back]');
assert.match(await O.locator('[data-testid=owner-back]').innerText(), /Mensagens/);
await O.goto(BASE + '/dashboard/caixa'); assert.equal(await O.locator('[data-testid=owner-back]').count(), 0, 'telas da barra de baixo não têm voltar');
console.log('2. telas internas do painel mostram o botão de voltar OK');

// 3. Avaliações: abas separadas, cada uma com a sua nota
await O.goto(BASE + '/dashboard/avaliacoes'); await O.waitForSelector('[data-testid=tab-servicos]');
assert.match(await O.locator('[data-testid=tab-servicos]').innerText(), /Atendimentos\s*·\s*1/);
assert.match(await O.locator('[data-testid=tab-indicacoes]').innerText(), /Indicações \(fotos\)\s*·\s*1/);
assert.ok(await O.locator('[data-testid=reviews-summary]').count());
await O.click('[data-testid=tab-indicacoes]'); await O.waitForURL('**/dashboard/indicacoes');
await O.waitForSelector('[data-testid=posts-summary]');
assert.match(await O.locator('[data-testid=posts-summary]').innerText(), /3,0/);
assert.ok(await O.locator('[data-testid=owner-post]').count() === 1);
assert.equal(await O.locator('[data-testid=reviews-summary]').count(), 0, 'a nota dos atendimentos não mistura com a das fotos');
await O.screenshot({ path: 'owner-avaliacoes-indicacoes.png' });
console.log('3. Avaliações tem aba de Atendimentos e de Indicações (fotos), com notas separadas OK');

// 4. app do cliente: convite para avaliar o atendimento concluído; uma estrela já abre a avaliação com a nota
const C = await mk({ width: 390, height: 844 }, true);
await C.goto(BASE + '/entrar'); await C.fill('#c-email', 'lucas@teste.com'); await C.fill('#c-password', 'senha-cliente-1'); await C.click('button[type=submit]'); await C.waitForURL('**/carteira**');
await C.waitForSelector('[data-testid=review-popup]');
assert.match(await C.locator('[data-testid=review-popup]').innerText(), /Como foi o atendimento\?[\s\S]*Corte/);
await C.screenshot({ path: 'cliente-convite-avaliar.png' });
await C.click('[data-testid=popup-star-4]'); await C.waitForURL('**/avaliar?nota=4');
await C.waitForSelector('[data-testid=review-form]');
assert.equal(await C.locator('[data-testid=stars-placeRating] [aria-checked=true]').getAttribute('aria-label'), '4 estrelas');
assert.equal(await C.locator('[data-testid=review-popup]').count(), 0, 'o convite não aparece na própria tela de avaliar');
console.log('4. o convite "Como foi o atendimento?" leva à avaliação com a nota escolhida OK');

// 5. "Agora não" guarda a escolha: não volta a aparecer nas outras telas
await C.goto(BASE + '/carteira'); await C.waitForSelector('[data-testid=review-popup]');
await C.click('[data-testid=popup-dismiss]'); await C.waitForSelector('[data-testid=review-popup]', { state: 'detached' });
await C.goto(BASE + '/lugares'); await C.waitForLoadState('networkidle');
assert.equal(await C.locator('[data-testid=review-popup]').count(), 0);
console.log('5. "Agora não" some com o convite OK');

await b.close();
console.log('ALL OK (painel mais claro e convite de avaliação)');
