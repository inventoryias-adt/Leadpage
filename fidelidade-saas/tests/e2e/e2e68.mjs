// Indicações: botão "+" no meio da barra do celular (center FAB); o cliente posta foto + nota + comentário de um lugar onde tem carteira,
// vê no feed, curte, denuncia a de outra pessoa e apaga a própria; sem carteira não indica; Instagram no Perfil.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const PHOTO = fileURLToPath(new URL('./fixtures/prato.png', import.meta.url));
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`truncate "RateLimit"; delete from "PostReport"; delete from "PostLike"; delete from "PostPhoto"; delete from "Post"; update "Customer" set instagram=null where id='${lucas}'`);
sql(`insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid()::text,'${lucas}','${rid}',100) on conflict ("customerId","restaurantId") do nothing`);
// segundo cliente, sem nenhuma carteira, e uma indicação dele (para o Lucas curtir e denunciar)
sql(`delete from "Customer" where email='ana.indica@teste.com'`);
sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash","termsAcceptedAt","termsVersion",instagram) select gen_random_uuid()::text,'00000000353',phone,'Ana Souza Lima','ana.indica@teste.com',"passwordHash","termsAcceptedAt","termsVersion",'ana.lima' from "Customer" where email='lucas@teste.com'`);
const ana = sql(`select id from "Customer" where email='ana.indica@teste.com'`);
sql(`insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid()::text,'${ana}','${rid}',50)`);
const anaPost = sql(`insert into "Post"(id,"customerId","restaurantId",rating,comment) values (gen_random_uuid()::text,'${ana}','${rid}',4,'Smash perfeito') returning id`).split('\n')[0];
sql(`insert into "PostPhoto"("postId",mime,data) values ('${anaPost}','image/png', decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64'))`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
const noOverflow = async (what) => assert.ok(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${what}: sem rolagem lateral`);

// 1. center FAB: botão "+" redondo, lima, no meio da barra e mais alto que as abas
await c.waitForSelector('[data-testid=fab-indicar]');
const nav = await c.locator('nav[aria-label="Navegação principal"].md\\:hidden').boundingBox();
const fab = await c.locator('[data-testid=fab-indicar]').boundingBox();
assert.ok(Math.abs(fab.x + fab.width / 2 - (nav.x + nav.width / 2)) < 6, 'no meio da barra');
assert.ok(fab.y < nav.y + 6, 'sobe acima das abas');
assert.ok(fab.width >= 56 && Math.abs(fab.width - fab.height) < 2, 'redondo e grande');
assert.deepEqual((await c.locator('nav[aria-label="Navegação principal"].md\\:hidden a:not([data-testid=fab-indicar])').allInnerTexts()).map((t) => t.replace(/^\d+\n/, '')), ['Início', 'Lugares', 'Avisos', 'Perfil']);
console.log('1. botão "+" em destaque no meio da barra (center FAB) OK');

// 2. o "+" abre a lista de indicações; o botão "Indicar" abre a nova indicação; sem foto e sem nota não publica
await c.click('[data-testid=fab-indicar]'); await c.waitForURL('**/indicacoes'); await c.waitForSelector('[data-testid=nova-indicacao]');
assert.equal(await c.locator('[data-testid=new-post-form]').count(), 0, 'o "+" abre a lista de indicações, não o formulário');
await c.click('[data-testid=nova-indicacao]'); await c.waitForURL('**/indicacoes/nova'); await c.waitForSelector('[data-testid=new-post-form]');
await c.click('[data-testid=publish-post]'); await c.waitForSelector('text=Escolha a foto da indicação');
console.log('2. "+" abre a lista; "Indicar" abre a nova indicação; sem foto não publica OK');

// 3. publica: foto, nota 5 e comentário; cai no feed com o aviso
await c.setInputFiles('[data-testid=post-photo-input]', PHOTO); await c.waitForSelector('[data-testid=photo-preview]');
await c.click('[data-testid=stars-rating] button[aria-label="5 estrelas"]');
await c.fill('#np-comment', 'Hambúrguer   suculento\n\n\n\ne rápido!');
await c.click('[data-testid=publish-post]'); await c.waitForURL('**/indicacoes?publicada=*'); await c.waitForSelector('[data-testid=publicada]');
const mine = sql(`select rating||'|'||comment||'|'||exists(select 1 from "PostPhoto" where "postId"=p.id)::text from "Post" p where "customerId"='${lucas}'`);
assert.equal(mine, '5|Hambúrguer suculento\n\ne rápido!|true');
await c.waitForSelector(`[data-post-id] [data-testid=post-comment]:has-text("Hambúrguer suculento")`);
assert.ok(await c.locator('[data-testid=post-card] img[src^="/api/indicacoes/foto/"]').count() >= 2, 'fotos servidas pela rota privada');
await noOverflow('feed');
console.log('3. publicar foto + nota + comentário e ver no feed OK');

// 4. curtir a da Ana (e descurtir); a foto só é servida a quem está logado
const anaCard = c.locator(`[data-post-id="${anaPost}"]`);
assert.match(await anaCard.innerText(), /Ana L\./); assert.match(await anaCard.innerText(), /@ana\.lima/);
await anaCard.locator('[data-testid=like]').click(); await c.waitForFunction((id) => document.querySelector(`[data-post-id="${id}"] [data-testid=like-count]`)?.textContent === '1', anaPost);
assert.equal(sql(`select count(*) from "PostLike" where "postId"='${anaPost}' and "customerId"='${lucas}'`), '1');
await anaCard.locator('[data-testid=like]').click(); await c.waitForFunction((id) => document.querySelector(`[data-post-id="${id}"] [data-testid=like-count]`)?.textContent === '0', anaPost);
assert.equal(sql(`select count(*) from "PostLike" where "postId"='${anaPost}'`), '0');
const anon = await b.newContext(); const noLogin = await anon.request.get(`${BASE}/api/indicacoes/foto/${anaPost}`);
assert.equal(noLogin.status(), 401);
console.log('4. curtir e descurtir; foto não é pública OK');

// 5. denunciar a indicação da Ana (não dá para denunciar a própria)
assert.equal(await c.locator(`[data-post-id] [data-testid=report-open]`).count(), 1, 'só a da Ana tem "Denunciar"');
await anaCard.locator('[data-testid=report-open]').click();
await anaCard.locator('textarea').fill('Foto imprópria');
await anaCard.locator('[data-testid=report-send]').click(); await c.waitForSelector('text=Denúncia enviada');
assert.equal(sql(`select count(*) from "PostReport" where "postId"='${anaPost}' and "reporterCustomerId"='${lucas}' and reason='Foto imprópria'`), '1');
assert.ok(sql(`select "reportedAt" is not null from "Post" where id='${anaPost}'`) === 't');
console.log('5. denúncia gravada e marcada para a administração OK');

// 6. indicação escondida pela administração some do feed dos outros (o autor ainda vê, marcada)
sql(`update "Post" set "hiddenAt"=now() where id='${anaPost}'`);
await c.goto(BASE + '/indicacoes'); await c.waitForSelector('[data-testid=feed]');
assert.equal(await c.locator(`[data-post-id="${anaPost}"]`).count(), 0);
sql(`update "Post" set "hiddenAt"=null where id='${anaPost}'`);
console.log('6. indicação escondida some do feed dos outros OK');

// 7. Minhas + filtro; apagar a própria
await c.goto(BASE + '/indicacoes?minhas=1'); await c.waitForSelector('[data-testid=feed]');
assert.equal(await c.locator('[data-testid=post-card]').count(), 1);
c.once('dialog', (d) => d.accept());
await c.click('[data-testid=delete-post]'); await c.waitForSelector('[data-testid=feed-empty]', { timeout: 15000 }).catch(() => {});
assert.equal(sql(`select count(*) from "Post" where "customerId"='${lucas}'`), '0');
assert.equal(sql(`select count(*) from "PostPhoto" pp join "Post" p on p.id=pp."postId" where p."customerId"='${lucas}'`), '0');
console.log('7. minhas indicações e apagar a própria (foto vai junto) OK');

// 8. quem não tem carteira não indica; o servidor também recusa
await c.goto(BASE + '/perfil'); // garante que o Lucas continua logado em outra aba
const other = await ctx.newPage();
sql(`delete from "Wallet" where "customerId"='${lucas}'`);
await other.goto(BASE + '/indicacoes/nova'); await other.waitForSelector('[data-testid=no-places]');
sql(`insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid()::text,'${lucas}','${rid}',100)`);
console.log('8. sem carteira: tela explica e não deixa indicar OK');

// 9. Instagram no Perfil: salva, normaliza, mostra botão e recusa lixo
await c.goto(BASE + '/perfil'); await c.waitForSelector('[data-testid=instagram-card]');
await c.fill('#ig-handle', 'instagram.com/Lucas.Silva/'); await c.click('[data-testid=save-instagram]'); await c.waitForSelector('text=Instagram salvo');
assert.equal(sql(`select instagram from "Customer" where id='${lucas}'`), 'lucas.silva');
assert.equal(await c.locator('[data-testid=open-instagram]').getAttribute('href'), 'https://www.instagram.com/lucas.silva/');
await c.fill('#ig-handle', 'não é um @'); await c.click('[data-testid=save-instagram]'); await c.waitForSelector('text=Use só o seu @');
assert.equal(sql(`select instagram from "Customer" where id='${lucas}'`), 'lucas.silva');
await c.fill('#ig-handle', ''); await c.click('[data-testid=save-instagram]'); await c.waitForSelector('text=Instagram removido');
assert.equal(sql(`select coalesce(instagram,'-') from "Customer" where id='${lucas}'`), '-');
await noOverflow('perfil');
console.log('9. Instagram no Perfil: salvar, normalizar, abrir e remover OK');

sql(`delete from "Post"; delete from "Customer" where email='ana.indica@teste.com'`);
await b.close();
