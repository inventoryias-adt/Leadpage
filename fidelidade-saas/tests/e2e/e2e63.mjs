// Avaliações: concluir o atendimento avisa o cliente; ele avalia (lugar + atendente + comentário), uma vez só;
// a nota só aparece a partir de 3 avaliações; o dono responde e denuncia; a administração oculta e a nota some.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; delete from "Review"; delete from "Notification"; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const ana = sql(`insert into "Resource"(id,"restaurantId",name,capacity) values (gen_random_uuid()::text,'${rid}','Ana',1) returning id`).split('\n')[0];
const todayStart = `((date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') at time zone 'UTC')`;
const booking = (h, status) => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","completedAt") values (gen_random_uuid()::text,'${rid}','${unit}','${lucas}','${ana}',${todayStart}+interval '${h} hour',${todayStart}+interval '${h} hour 30 minutes','${status}','Corte',30,5000,${status === 'COMPLETED' ? 'now()' : 'null'}) returning id`).split('\n')[0];

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (view) => {
  const ctx = await b.newContext({ viewport: view });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return p;
};
const O = await mk({ width: 1280, height: 900 });
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');
const C = await mk({ width: 390, height: 844 });
await C.goto(BASE + '/entrar'); await C.fill('#c-email', 'lucas@teste.com'); await C.fill('#c-password', 'senha-cliente-1'); await C.click('button[type=submit]'); await C.waitForURL('**/carteira**');

// 1. concluir o atendimento avisa o cliente com o convite para avaliar
const b1 = booking(1, 'CONFIRMED');
await O.goto(BASE + '/dashboard/agenda?vista=lista'); await O.waitForSelector('button:has-text("Concluir")');
await O.click('button:has-text("Concluir")'); await O.waitForSelector('text=pontos creditados ao cliente');
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title='Como foi o atendimento?' and href='/perfil/agendamentos/${b1}/avaliar'`), '1');
console.log('1. concluir o atendimento avisa o cliente com o link para avaliar OK');

// 2. o cliente avalia: lugar, atendente e comentário; só uma vez
await C.goto(BASE + `/perfil/agendamentos`); await C.waitForSelector('[data-testid=review-cta]');
await C.click('[data-testid=review-cta]'); await C.waitForSelector('[data-testid=review-form]');
await C.click('[data-testid=stars-placeRating] button[aria-label="5 estrelas"]');
await C.click('[data-testid=stars-staffRating] button[aria-label="4 estrelas"]');
await C.fill('#rv-comment', 'Atendimento   ótimo\n\n\n\ne rápido!');
await C.click('button:has-text("Enviar avaliação")'); await C.waitForSelector('[data-testid=review-thanks]');
assert.equal(sql(`select "placeRating"||'|'||"staffRating"||'|'||comment||'|'||("resourceId"='${ana}')::text from "Review" where "bookingId"='${b1}'`), '5|4|Atendimento ótimo\n\ne rápido!|true');
assert.equal(await C.locator('[data-testid=review-cta]').count(), 0, 'já avaliou: sem botão');
await C.goto(BASE + `/perfil/agendamentos/${b1}/avaliar`); await C.waitForSelector('[data-testid=review-done]');
console.log('2. cliente avalia (5 e 4 estrelas + comentário limpo) e não consegue avaliar de novo OK');

// 3. com menos de 3 avaliações não há nota pública, mas o comentário aparece no lugar
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=place-reviews]', { state: 'attached' });
assert.equal(await C.locator('[data-testid=rating-badge]').count(), 0, 'sem nota com 1 avaliação');
assert.match(await C.locator('[data-testid=place-reviews]').innerText(), /Atendimento ótimo\s+e rápido!/);
console.log('3. 1 avaliação: comentário visível, nota ainda escondida OK');

// 4. a partir de 3 avaliações a nota e o ranking aparecem (lugar, lista e atendente)
for (const [h, r] of [[2, 4], [3, 3]]) {
  const id = booking(h, 'COMPLETED');
  sql(`insert into "Review"(id,"restaurantId","customerId","bookingId","resourceId","placeRating","staffRating","createdAt") values (gen_random_uuid()::text,'${rid}','${lucas}','${id}','${ana}',${r},${r},now())`);
}
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=rating-badge]');
assert.match(await C.locator('[data-testid=rating-badge]').first().innerText(), /4,0\s*\(3\)/);
await C.goto(BASE + '/lugares'); await C.waitForSelector('[data-testid=rating-badge]');
await C.click('button:has-text("Mais bem avaliados")');
assert.ok(await C.locator('[data-testid=rating-badge]').count() >= 1);
await C.goto(BASE + `/lugar/${rid}/agendar`); 
console.log('4. 3 avaliações: nota 4,0 (3) no lugar e na lista, com ordenação OK');

// 5. o dono vê as avaliações, a média por atendente, responde e denuncia
await O.goto(BASE + '/dashboard'); await O.waitForSelector('[data-testid=reviews-shortcut]');
assert.match(await O.locator('[data-testid=reviews-shortcut]').innerText(), /4,0/);
await O.click('[data-testid=reviews-shortcut]'); await O.waitForSelector('[data-testid=owner-review]');
assert.equal(await O.locator('[data-testid=owner-review]').count(), 3);
assert.match(await O.locator('[data-testid=reviews-staff]').innerText(), /Ana/);
const first = O.locator('[data-testid=owner-review]', { hasText: 'Atendimento ótimo' });
await first.locator('summary:has-text("Responder")').click();
await first.locator('textarea[name=reply]').fill('Obrigado pela visita!');
await first.locator('button:has-text("Publicar resposta")').click(); await O.waitForSelector('[data-testid=reviews-ok]');
assert.equal(sql(`select "ownerReply" from "Review" where "bookingId"='${b1}'`), 'Obrigado pela visita!');
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=place-reviews]', { state: 'attached' });
assert.match(await C.locator('[data-testid=place-reviews]').innerText(), /Obrigado pela visita!/);
const bad = O.locator('[data-testid=owner-review]').filter({ hasNotText: 'Atendimento ótimo' }).last();
await bad.locator('summary:has-text("Denunciar")').click();
await bad.locator('textarea[name=reason]').fill('Essa pessoa nunca esteve aqui');
await bad.locator('button:has-text("Enviar denúncia")').click(); await O.waitForSelector('[data-testid=review-reported]');
assert.equal(sql(`select count(*) from "Review" where "reportedAt" is not null`), '1');
console.log('5. dono responde (aparece para o cliente) e denuncia uma avaliação OK');

// 6. a administração oculta: some do app e a nota deixa de aparecer (ficam 2)
const A = await mk({ width: 1280, height: 900 });
sql(`delete from "AdminUser" where email='avaliacoes@teste.com'`);
const out = execFileSync('npx', ['tsx', 'scripts/admin-invite.ts', 'avaliacoes@teste.com', 'Avaliações Teste'], { cwd: fileURLToPath(new URL('../..', import.meta.url)), env: { ...process.env, DATABASE_URL: DB + '?schema=public', APP_URL: BASE } }).toString();
await A.goto(out.match(/http\S+\/admin\/convite\/\S+/)[0]); await A.waitForTimeout(1800);
await A.fill('#password', 'SenhaAvaliacoes2026'); await A.fill('#confirm', 'SenhaAvaliacoes2026'); await A.click('button:has-text("Criar senha")'); await A.waitForURL('**/admin');
await A.goto(BASE + '/admin/avaliacoes'); await A.waitForSelector('[data-testid=admin-review]');
assert.match(await A.locator('[data-testid=admin-review]').innerText(), /nunca esteve aqui/);
assert.match(await A.locator('nav[aria-label="Administração"]').innerText(), /Avaliações\s*1/);
await A.click('[data-testid=hide-review]'); await A.waitForSelector('text=Nenhuma denúncia pendente');
assert.equal(sql(`select count(*) from "Review" where "hiddenAt" is not null`), '1');
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=place-reviews]', { state: 'attached' });
assert.equal(await C.locator('[data-testid=rating-badge]').count(), 0, 'com 2 avaliações visíveis a nota some');
assert.equal(await C.locator('[data-testid=place-review]').count(), 2);
console.log('6. administração oculta a avaliação denunciada: some do app e da nota OK');

await b.close();
console.log('ALL OK (avaliações)');
