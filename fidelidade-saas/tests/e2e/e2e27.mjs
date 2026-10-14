import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),listed=true; delete from "Promotion" where "appCampaignId" is not null; delete from "AppCampaign"; delete from "AdminLog"; delete from "AdminUser"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const hash = sql(`select "passwordHash" from "Restaurant" where email='ze@burger.com'`);
sql(`insert into "AdminUser"(id,email,name,"passwordHash",active) values (gen_random_uuid(),'admin@teste.com','Admin','${hash}',true)`);
const cid = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`delete from "Wallet" where "customerId"='${cid}'; delete from "Redemption"; insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid(),'${cid}','${rid}',500)`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const mk = async (w = 1280, h = 900) => { const c = await b.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); }); const p = await c.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); return [c, p]; };

// 1. administrador cria a campanha do app
const [, a] = await mk();
await a.goto(BASE + '/admin/entrar'); await a.fill('#email', 'admin@teste.com'); await a.fill('#password', 'senha-segura-1'); await a.click('button[type=submit]'); await a.waitForURL('**/admin');
await a.goto(BASE + '/admin/campanhas');
await a.fill('#novo-title', 'Terça e quinta em dobro'); await a.fill('#novo-desc', 'Compre nos lugares participantes e ganhe o dobro de pontos.');
await a.fill('#novo-mult', '2'); await a.click('label:has-text("Ter")'); await a.click('label:has-text("Qui")');
await a.click('button:has-text("Criar campanha")'); await a.waitForSelector('text=Campanha criada');
const camp = sql(`select id from "AppCampaign" where title='Terça e quinta em dobro'`);
assert.equal(sql(`select multiplier||'|'||array_to_string(weekdays,',') from "AppCampaign" where id='${camp}'`), '2|2,4');
// validação
await a.fill('#novo-title', 'Inválida'); await a.fill('#novo-mult', '1'); await a.click('button:has-text("Criar campanha")'); await a.waitForSelector('text=multiplicador precisa ficar entre');
assert.equal(sql(`select count(*) from "AppCampaign"`), '1');
console.log('1. admin cria a campanha do app (e a validação recusa multiplicador 1x) OK');

// 2. cliente: ainda ninguém adotou → não aparece no Início
const [, c] = await mk(420, 900);
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'lucas@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');
assert.equal(await c.locator('text=Terça e quinta em dobro').count(), 0, 'sem adesão, a campanha não aparece para o cliente');
console.log('2. sem nenhum lugar participando, o cliente não vê a campanha OK');

// 3. dono adota em Regras → Campanhas
const [, o] = await mk();
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('#campanhas');
await o.click('#campanhas button:has-text("Participar da campanha")');
await o.waitForSelector('#campanhas button:has-text("Participando")');
assert.equal(sql(`select title||'|'||kind||'|'||multiplier||'|'||array_to_string(weekdays,',')||'|'||audience||'|'||active from "Promotion" where "appCampaignId"='${camp}' and "restaurantId"='${rid}'`), 'Terça e quinta em dobro|MULTIPLIER|2|2,4|ALL|true');
assert.ok(await o.locator('#campanhas >> text=Campanha do app').count() >= 1, 'aparece também na lista de campanhas do dono');
console.log('3. dono adota: vira promoção dele (2x, terça e quinta, todos os clientes) OK');

// 4. cliente vê no Início e abre a página com quem participa
await c.reload();
await c.waitForSelector('text=Campanhas do app');
assert.ok(await c.locator('a:has-text("1 lugar participa")').count());
await c.click('a:has-text("1 lugar participa")'); await c.waitForURL('**/campanhas/**');
assert.ok(await c.locator('text=Lugares que participam (1)').count());
assert.ok(await c.locator('a:has-text("Burger do Zé")').count());
console.log('4. cliente vê a campanha no Início e a lista de quem participa OK');

// 5. o motor de pontos usa a campanha (terça/quinta = 2x): conferência direta da regra aplicada
const live = sql(`select count(*) from "Promotion" where "appCampaignId"='${camp}' and active`);
assert.equal(live, '1');

// 6. admin edita: a promoção do dono acompanha
await a.reload();
await a.click('summary:has-text("Editar")');
await a.fill(`#ed-${camp}-title`, 'Terça e quinta em triplo'); await a.fill(`#ed-${camp}-mult`, '3');
await a.click('details button:has-text("Salvar alterações")'); await a.waitForSelector('text=Campanha atualizada');
assert.equal(sql(`select title||'|'||multiplier from "Promotion" where "appCampaignId"='${camp}'`), 'Terça e quinta em triplo|3');
console.log('6. admin edita e a promoção de quem adotou acompanha OK');

// 7. dono pausa a sua; admin edita de novo e NÃO reativa
await o.reload(); 
sql(`update "Promotion" set active=false where "appCampaignId"='${camp}'`);
await a.fill(`#ed-${camp}-title`, 'Terça e quinta em triplo!'); await a.click('details button:has-text("Salvar alterações")'); await a.waitForSelector('text=Campanha atualizada');
assert.equal(sql(`select active from "Promotion" where "appCampaignId"='${camp}'`), 'f', 'editar não reativa o que o dono pausou');
console.log('7. edição do admin não reativa o que o dono pausou OK');

// 8. admin desliga: promoção desativada e some do cliente; religar reativa
sql(`update "Promotion" set active=true where "appCampaignId"='${camp}'`);
await a.goto(BASE + '/admin/campanhas'); await a.click(`li:has-text("triplo") button:text-is("Desligar")`);
await a.waitForSelector('li:has-text("triplo") button:text-is("Ligar")');
assert.equal(sql(`select active from "Promotion" where "appCampaignId"='${camp}'`), 'f');
await c.goto(BASE + '/carteira'); assert.equal(await c.locator('text=Campanhas do app').count(), 0);
await a.click(`li:has-text("triplo") button:text-is("Ligar")`); await a.waitForSelector('li:has-text("triplo") button:text-is("Desligar")');
assert.equal(sql(`select active from "Promotion" where "appCampaignId"='${camp}'`), 't');
console.log('8. desligar/ligar a campanha acompanha nas promoções e na vitrine do cliente OK');

// 9. dono sai da campanha
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.click('#campanhas button:has-text("Participando")'); await o.waitForSelector('#campanhas button:has-text("Participar da campanha")');
assert.equal(sql(`select count(*) from "Promotion" where "appCampaignId"='${camp}'`), '0');
console.log('9. dono sai e a promoção some OK');

// 10. páginas inexistentes / desligadas não vazam
sql(`update "AppCampaign" set active=false`);
const r = await c.request.get(BASE + '/campanhas/' + camp); assert.equal(r.status(), 404);
assert.equal((await c.request.get(BASE + '/campanhas/nao-e-uuid')).status(), 404);
console.log('ALL OK (campanhas do app)');
await b.close();
