// Chat entre cliente e estabelecimento (nos dois sentidos, com aviso e bolinhas) e galeria "Fotos dos clientes" na página do lugar.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const PNG = `decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64')`;
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`truncate "RateLimit"; delete from "ChatMessage"; delete from "Conversation"; delete from "Notification" where title like '% respondeu'; delete from "PostReport"; delete from "PostLike"; delete from "PostPhoto"; delete from "Post"`);
sql(`update "Restaurant" set "subscriptionStatus"='ACTIVE', "onboardedAt"=coalesce("onboardedAt",now()) where id='${rid}'`);
sql(`insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid()::text,'${lucas}','${rid}',100) on conflict ("customerId","restaurantId") do nothing`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (w, h, mobile = false) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return p;
};
const C = await mk(390, 844, true);
await C.goto(BASE + '/entrar'); await C.fill('#c-email', 'lucas@teste.com'); await C.fill('#c-password', 'senha-cliente-1'); await C.click('button[type=submit]'); await C.waitForURL('**/carteira**');
const O = await mk(1100, 900);
await O.goto(BASE + '/login'); await O.fill('#email', 'ze@burger.com'); await O.fill('#password', 'senha-segura-1'); await O.click('button[type=submit]'); await O.waitForURL('**/dashboard');

// 1. galeria: sem fotos mostra o convite; com fotos mostra a grade com nota e curtidas e leva ao feed do lugar
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('text=Fotos dos clientes');
assert.match(await C.locator('body').innerText(), /Seja o primeiro a postar/i);
const post = sql(`insert into "Post"(id,"customerId","restaurantId",rating,comment) values (gen_random_uuid()::text,'${lucas}','${rid}',5,'Top') returning id`).split('\n')[0];
sql(`insert into "PostPhoto"("postId",mime,data) values ('${post}','image/png',${PNG}); insert into "PostLike"("postId","customerId") values ('${post}','${lucas}')`);
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=place-photos] li');
assert.equal(await C.locator('[data-testid=place-photos] li').count(), 1);
assert.match(await C.locator('[data-testid=place-photos]').innerText(), /★ 5/); assert.match(await C.locator('[data-testid=place-photos]').innerText(), /♥ 1/);
assert.equal(await C.locator('[data-testid=place-photos] img').evaluate((i) => new Promise((ok) => (i.complete ? ok(i.naturalWidth) : (i.onload = () => ok(i.naturalWidth))))), 1, 'a foto carrega');
assert.ok((await C.locator('[data-testid=place-photos-new]').getAttribute('href')).endsWith(`/indicacoes/nova?lugar=${rid}`));
await C.click('[data-testid=place-photos-all]'); await C.waitForURL(`**/indicacoes?lugar=${rid}`); await C.waitForSelector('[data-testid=post-card]');
assert.equal(await C.locator('[data-testid=post-card]').count(), 1);
console.log('1. galeria de fotos dos clientes no lugar: convite, grade, nota, curtidas e "ver todas" OK');
// foto escondida pela moderação some da galeria
sql(`update "Post" set "hiddenAt"=now() where id='${post}'`);
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('text=Fotos dos clientes');
assert.equal(await C.locator('[data-testid=place-photos] li').count(), 0);
console.log('2. foto escondida pela moderação não aparece na galeria OK');

// 3. cliente abre o chat pela página do lugar e escreve
await C.goto(BASE + `/lugar/${rid}`); await C.waitForSelector('[data-testid=chat-open]');
await C.click('[data-testid=chat-open]'); await C.waitForURL(`**/mensagens/${rid}`); await C.waitForSelector('[data-testid=chat-empty]');
await C.fill('[data-testid=chat-input]', 'Boa tarde! Vocês fazem hambúrguer sem glúten?');
await C.click('[data-testid=chat-send]'); await C.waitForSelector('[data-testid=msg-mine]:has-text("sem glúten")');
assert.equal(sql(`select count(*) from "ChatMessage" where sender='CUSTOMER'`), '1');
console.log('3. cliente abre a conversa pelo lugar e envia a primeira mensagem OK');

// 4. dono: bolinha no menu e na lista; abre, responde (Enter envia)
await O.goto(BASE + '/dashboard'); await O.waitForSelector('[data-testid=chats-shortcut]');
assert.match(await O.locator('[data-testid=chats-shortcut]').innerText(), /1 conversa nova/);
assert.match(await O.locator('nav a[href="/dashboard/mensagens"]').innerText(), /1/);
await O.goto(BASE + '/dashboard/mensagens'); await O.waitForSelector('[data-testid=chat-row]');
assert.equal(await O.locator('[data-testid=chat-unread]').count(), 1);
assert.match(await O.locator('[data-testid=chat-row]').innerText(), /sem glúten/);
await O.click('[data-testid=chat-row]'); await O.waitForSelector('[data-testid=msg-theirs]:has-text("sem glúten")');
assert.equal(sql(`select ("restaurantReadAt" is not null)::text from "Conversation"`), 'true', 'abrir marca como lida');
await O.fill('[data-testid=chat-input]', 'Temos sim! Pão sem glúten por R$ 4 a mais.'); await O.press('[data-testid=chat-input]', 'Enter');
await O.waitForSelector('[data-testid=msg-mine]:has-text("Pão sem glúten")');
console.log('4. dono vê a bolinha, abre, a conversa fica lida e ele responde com Enter OK');

// 5. cliente recebe a resposta sem recarregar (atualização automática), ganha aviso e bolinha no Perfil
await C.waitForSelector('[data-testid=msg-theirs]:has-text("Pão sem glúten")', { timeout: 20000 });
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title like '% respondeu' and href='/mensagens/${rid}'`), '1');
await C.goto(BASE + '/perfil'); await C.waitForSelector('[data-testid=my-chats-link]');
assert.doesNotMatch(await C.locator('[data-testid=my-chats-link]').innerText(), /novidade/);
console.log('5. cliente recebe a resposta ao vivo, com aviso, e a conversa fica lida OK');

// 6. nova resposta com a conversa fechada: bolinha no Perfil, lista e aviso; um aviso só enquanto não ler
await O.fill('[data-testid=chat-input]', 'Qualquer coisa é só chamar.'); await O.click('[data-testid=chat-send]'); await O.waitForSelector('[data-testid=msg-mine]:has-text("só chamar")');
await O.fill('[data-testid=chat-input]', 'Aceitamos pix também.'); await O.click('[data-testid=chat-send]'); await O.waitForSelector('[data-testid=msg-mine]:has-text("pix")');
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title like '% respondeu' and "readAt" is null`), '1', 'um aviso só por rodada');
await C.goto(BASE + '/perfil'); await C.waitForSelector('[data-testid=my-chats-link]');
assert.match(await C.locator('[data-testid=my-chats-link]').innerText(), /1 conversa com novidade/);
await C.goto(BASE + '/mensagens'); await C.waitForSelector('[data-testid=chat-row]');
assert.equal(await C.locator('[data-testid=chat-unread]').count(), 1);
await C.click('[data-testid=chat-row]'); await C.waitForSelector('[data-testid=msg-theirs]:has-text("pix")');
assert.equal(await C.locator('[data-testid=msg-theirs]').count(), 3);
assert.equal(sql(`select count(*) from "Notification" where "customerId"='${lucas}' and title like '% respondeu' and "readAt" is null`), '0', 'abrir a conversa apaga o aviso');
assert.ok(await C.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sem rolagem lateral');
console.log('6. bolinhas no Perfil e na lista, um aviso por rodada, ler apaga o aviso OK');

// 7. regras: texto vazio não envia; só quem tem carteira conversa; outro cliente não lê a conversa
assert.equal(await C.locator('[data-testid=chat-send]').isDisabled(), true);
const conv = sql(`select id from "Conversation"`);
sql(`delete from "Customer" where email='outro.chat@teste.com'`);
sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash","termsAcceptedAt","termsVersion") select gen_random_uuid()::text,'00000000469',phone,'Outro Cliente','outro.chat@teste.com',"passwordHash","termsAcceptedAt","termsVersion" from "Customer" where email='lucas@teste.com'`);
const X = await mk(390, 844, true);
await X.goto(BASE + '/entrar'); await X.fill('#c-email', 'outro.chat@teste.com'); await X.fill('#c-password', 'senha-cliente-1'); await X.click('button[type=submit]'); await X.waitForURL('**/carteira**');
await X.goto(BASE + `/mensagens/${rid}`); await X.waitForSelector('[data-testid=chat-blocked]');
assert.match(await X.locator('[data-testid=chat-blocked]').innerText(), /já tem carteira/);
assert.equal(await X.locator('[data-testid=chat-input]').count(), 0);
await X.goto(BASE + `/lugar/${rid}`); await X.waitForSelector('text=Burger');
assert.equal(await X.locator('[data-testid=chat-open]').count(), 0, 'sem carteira não há botão Conversar');
assert.equal(sql(`select count(*) from "ChatMessage"`), '4');
console.log('7. sem carteira não há conversa (nem botão); vazio não envia OK');

// 8. dono abre o cliente por Clientes → "Conversar no app"; sem login a tela pede entrada
await O.goto(BASE + `/dashboard/clientes/${lucas}`); await O.waitForSelector('[data-testid=chat-open]');
await O.click('[data-testid=chat-open]'); await O.waitForURL(`**/dashboard/mensagens/${lucas}`); await O.waitForSelector('[data-testid=msg-mine]');
assert.equal(await O.locator('[data-testid=msg-mine]').count(), 3);
const anon = await b.newContext(); const ap = await anon.newPage();
await ap.goto(BASE + `/mensagens/${rid}`); await ap.waitForURL('**/entrar**');
await ap.goto(BASE + `/dashboard/mensagens/${lucas}`); await ap.waitForURL('**/login**');
await anon.close();
console.log('8. dono abre a conversa pela ficha do cliente; sem login pede entrada OK');

sql(`delete from "ChatMessage"; delete from "Conversation"; delete from "Post"; delete from "Customer" where email='outro.chat@teste.com'`);
await b.close();
