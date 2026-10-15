import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const DB='postgresql://postgres:postgres@localhost:5432/fidelidade';
const MAIL = process.env.DEV_MAIL_FILE || '/tmp/dev-mail.jsonl';
const sql=(q)=>execFileSync('psql',[DB,'-At','-c',q]).toString().trim();
const wait=(p,t)=>p.waitForTimeout(t);
const mails=()=>{ try { return readFileSync(MAIL,'utf8').trim().split('\n').filter(Boolean).map((l)=>JSON.parse(l)); } catch { return []; } };
writeFileSync(MAIL,'');
const lucasHash = sql(`select "passwordHash" from "Customer" where email='lucas@teste.com'`);
sql('truncate "RateLimit"; delete from "PasswordReset"');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const fresh = async () => { const c = await browser.newContext({viewport:{width:420,height:900}}); await c.addInitScript(()=>localStorage.setItem('fz_intro_v1','1')); const p = await c.newPage(); p.on('pageerror',e=>console.log('PAGEERROR',e.message)); return p; };
const submit = (p,t) => p.click(`button[type=submit]:has-text("${t}")`);

// --- cliente
let p = await fresh();
await p.goto(BASE+'/entrar'); await wait(p,1800);
await p.click('text=Esqueci minha senha');
await p.waitForSelector('h2:has-text("Esqueci minha senha")');
await p.fill('#forgot-customer','ninguem@naoexiste.com'); await submit(p,'Enviar link por e-mail');
await p.waitForSelector('text=Se este e-mail tiver cadastro'); await wait(p,600);
assert.equal(mails().length, 0, 'e-mail inexistente: nada é enviado (e a resposta é a mesma)');
await p.fill('#forgot-customer','lucas@teste.com'); await submit(p,'Enviar link por e-mail');
await p.waitForSelector('text=Se este e-mail tiver cadastro'); await wait(p,800);
assert.equal(mails().length, 1);
const m = mails()[0];
assert.equal(m.to,'lucas@teste.com'); assert.match(m.text,/Olá, Lucas!/);
const link = m.text.match(/http\S+\/redefinir\/cliente\/\S+/)[0];
const token = link.split('/').pop();
assert.ok(!sql(`select "tokenHash" from "PasswordReset" limit 1`).includes(token), 'só o hash fica no banco');
console.log('1. cliente: pedido de link responde igual com e-mail existente ou não; só envia para quem tem conta; só o hash fica no banco OK');

await p.goto(link); await wait(p,1500);
await p.fill('#rp-pw','senha-nova-cli-1'); await p.fill('#rp-conf','outra-coisa-aqui'); await submit(p,'Salvar senha nova');
await p.waitForSelector('text=As senhas não são iguais'); await wait(p,800);
await p.fill('#rp-pw','senha-nova-cli-1'); await p.fill('#rp-conf','senha-nova-cli-1'); await submit(p,'Salvar senha nova');
await p.waitForSelector('text=Senha alterada'); await wait(p,500);
// a senha antiga não vale mais; a nova entra
const q = await fresh(); await q.goto(BASE+'/entrar'); await wait(q,1500);
await q.fill('#c-email','lucas@teste.com'); await q.fill('#c-password','senha-cliente-1'); await submit(q,'Entrar'); await q.waitForSelector('text=E-mail ou senha incorretos.'); await wait(q,900);
await q.fill('#c-email','lucas@teste.com'); await q.fill('#c-password','senha-nova-cli-1'); await submit(q,'Entrar'); await q.waitForURL('**/carteira');
console.log('2. cliente: redefine pela página do link e entra com a senha nova (a antiga deixa de valer) OK');

// link usado não funciona de novo; link inventado e vencido também não
const r = await fresh(); await r.goto(link); await wait(r,1500);
await r.waitForSelector('text=inválido, já foi usado ou venceu');
await r.goto(BASE+'/redefinir/cliente/'+'a'.repeat(43)); await wait(r,1200);
await r.waitForSelector('text=inválido, já foi usado ou venceu');
const p2 = await fresh(); await p2.goto(BASE+'/entrar'); await wait(p2,1500);
await p2.click('text=Esqueci minha senha'); await p2.fill('#forgot-customer','lucas@teste.com'); await submit(p2,'Enviar link por e-mail'); await p2.waitForSelector('text=Se este e-mail tiver cadastro'); await wait(p2,800);
const link2 = mails().at(-1).text.match(/http\S+\/redefinir\/cliente\/\S+/)[0];
assert.notEqual(link2, link);
sql(`update "PasswordReset" set "expiresAt"=now()-interval '1 minute'`);
await r.goto(link2); await wait(r,1200); await r.waitForSelector('text=inválido, já foi usado ou venceu');
console.log('3. link usado, inventado e vencido são recusados OK');

// o caminho antigo por CPF + telefone não redefine mais quem já tem senha
const s = await fresh(); await s.goto(BASE+'/entrar'); await wait(s,1500);
await s.click('text=Crie seu e-mail e senha');
await s.fill('#r-cpf','529.982.247-25'); await s.fill('#r-phone','11999998888'); await s.fill('#r-email','lucas@teste.com'); await s.fill('#r-password','tentativa-12345');
await submit(s,'Criar acesso e entrar'); await s.waitForSelector('text=já tem senha');
console.log('4. quem já tem senha não redefine mais só com CPF + telefone OK');

// --- dono
const o = await fresh(); await o.goto(BASE+'/login'); await wait(o,1500);
await o.click('text=Esqueci minha senha'); await o.waitForURL('**/login/esqueci'); await wait(o,1200);
const before = mails().length;
await o.fill('#forgot-restaurant','ze@burger.com'); await submit(o,'Enviar link por e-mail'); await o.waitForSelector('text=Se este e-mail tiver cadastro'); await wait(o,900);
assert.equal(mails().length, before+1);
const ownerLink = mails().at(-1).text.match(/http\S+\/redefinir\/dono\/\S+/)[0];
await o.goto(ownerLink); await wait(o,1500);
await o.fill('#rp-pw','senha-segura-1'); await o.fill('#rp-conf','senha-segura-1'); await submit(o,'Salvar senha nova'); await o.waitForSelector('text=Senha alterada');
await o.click('a:has-text("Entrar")'); await o.waitForURL('**/login'); await wait(o,1200);
await o.fill('#email','ze@burger.com'); await o.fill('#password','senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
console.log('5. dono: esqueci a senha → link → senha nova → entra no painel OK');

// limite de pedidos por e-mail
const t = await fresh(); await t.goto(BASE+'/entrar'); await wait(t,1500); await t.click('text=Esqueci minha senha');
let limited=false;
for (let i=0;i<6;i++){ await t.fill('#forgot-customer','lucas@teste.com'); await submit(t,'Enviar link por e-mail'); await wait(t,700); if (await t.locator('text=Muitas tentativas').count()) { limited=true; break; } }
assert.ok(limited,'limite de pedidos');
console.log('6. limite de pedidos de link por e-mail OK');
sql('truncate "RateLimit"');
// restaura a senha do Lucas para os outros testes
execFileSync('psql',[DB,'-At','-c',`update "Customer" set "passwordHash"='${lucasHash}' where email='lucas@teste.com'`]);
await browser.close();
