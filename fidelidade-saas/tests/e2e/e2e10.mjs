import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const DB='postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql=(q)=>execSync(`psql ${DB} -At -c ${JSON.stringify(q)}`).toString().trim();
const wait=(p,t)=>p.waitForTimeout(t);
sql('TRUNCATE "RateLimit"');
sql(`delete from "Customer" where cpf in ('39053344705','16899535009') and name like 'e2e10%'`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const fresh = async (vp={width:420,height:900}) => { const c = await browser.newContext({viewport:vp}); await c.addInitScript(()=>localStorage.setItem('fz_intro_v1','1')); const p = await c.newPage(); p.on('pageerror',e=>console.log('PAGEERROR',e.message)); return p; };
const submit = (p,t) => p.click(`button[type=submit]:has-text("${t}")`);

// 1. entrar mostra só e-mail e senha (nada de nome/telefone) e tem a opção de criar conta
let p = await fresh();
await p.goto(BASE+'/entrar'); await wait(p,2000);
assert.equal(await p.locator('#c-email').count(),1); assert.equal(await p.locator('#c-password').count(),1);
assert.equal(await p.locator('input[name=name]').count(),0); assert.equal(await p.locator('input[name=phone]').count(),0); assert.equal(await p.locator('input[name=cpf]').count(),0);
await p.waitForSelector('[role=tab]:has-text("Criar conta")');
console.log('1. entrar pede só e-mail e senha, com opção de criar conta OK');

// 2. senha errada e e-mail desconhecido dão a mesma mensagem
await p.fill('#c-email','lucas@teste.com'); await p.fill('#c-password','senha-errada'); await submit(p,'Entrar');
await p.waitForSelector('text=E-mail ou senha incorretos.'); await wait(p,900);
await p.fill('#c-email','ninguem@teste.com'); await p.fill('#c-password','qualquer-coisa'); await submit(p,'Entrar');
await p.waitForSelector('text=E-mail ou senha incorretos.'); await wait(p,900);
console.log('2. senha errada e e-mail inexistente: mesma mensagem OK');

// 3. entrar certo
await p.fill('#c-email','LUCAS@teste.com'); await p.fill('#c-password','senha-cliente-1'); await submit(p,'Entrar');
await p.waitForURL('**/carteira');
console.log('3. entrada com e-mail (maiúsculas ignoradas) e senha OK');

// 4. criar conta: validações e sucesso
p = await fresh();
await p.goto(BASE+'/entrar'); await wait(p,2000);
await p.click('[role=tab]:has-text("Criar conta")');
await p.fill('#s-name','e2e10 Ana'); await p.fill('#s-cpf','390.533.447-05'); await p.fill('#s-phone','11977776666'); await p.fill('#s-email','ana@teste.com'); await p.fill('#s-password','curta');
// a validação do navegador (minLength) barra senha curta; remove para provar também a do servidor
await p.evaluate(()=>{ document.querySelector('#s-password').removeAttribute('minlength'); });
await submit(p,'Criar minha conta'); await p.waitForSelector('text=pelo menos 8 caracteres'); await wait(p,900);
await p.fill('#s-password','senha-ana-123'); await p.fill('#s-email','lucas@teste.com'); await submit(p,'Criar minha conta');
await p.waitForSelector('text=Este e-mail já está em uso'); await wait(p,900);
await p.fill('#s-email','ana@teste.com'); await p.fill('#s-cpf','529.982.247-25'); await p.fill('#s-password','senha-ana-123'); await submit(p,'Criar minha conta');
await p.waitForSelector('text=Este CPF já tem cadastro'); await wait(p,900);
await p.fill('#s-cpf','390.533.447-05'); await p.fill('#s-password','senha-ana-123'); await submit(p,'Criar minha conta');
await p.waitForURL('**/carteira');
assert.equal(sql(`select count(*) from "Customer" where email='ana@teste.com' and "passwordHash" like 'scrypt$%' and cpf='39053344705'`),'1');
assert.ok(!sql(`select "passwordHash" from "Customer" where email='ana@teste.com'`).includes('senha-ana-123'));
console.log('4. criar conta (validações, e-mail/CPF repetidos, senha guardada só como hash) OK');

// 5. cliente antigo (CPF + telefone, sem e-mail): não entra por e-mail, cria o acesso uma vez
sql(`insert into "Customer"(id,cpf,phone,name,"referralCode") values (gen_random_uuid(),'16899535009','11955554444','e2e10 Antigo','E2E10ABC') on conflict do nothing`);
p = await fresh();
await p.goto(BASE+'/entrar'); await wait(p,2000);
await p.click('text=Crie seu e-mail e senha');
await p.waitForSelector('text=Já tenho cadastro'); await wait(p,900);
await p.fill('#r-cpf','168.995.350-09'); await p.fill('#r-phone','11900000000'); await p.fill('#r-email','antigo@teste.com'); await p.fill('#r-password','senha-antigo-1');
await submit(p,'Criar acesso e entrar'); await p.waitForSelector('text=telefone não confere'); await wait(p,900);
await p.fill('#r-cpf','168.995.350-09'); await p.fill('#r-phone','11955554444'); await p.fill('#r-email','lucas@teste.com'); await p.fill('#r-password','senha-antigo-1');
await submit(p,'Criar acesso e entrar'); await p.waitForSelector('text=já está em uso por outra conta'); await wait(p,900);
await p.fill('#r-cpf','168.995.350-09'); await p.fill('#r-phone','11955554444'); await p.fill('#r-email','antigo@teste.com'); await p.fill('#r-password','senha-antigo-1');
await submit(p,'Criar acesso e entrar'); await p.waitForURL('**/carteira');
assert.equal(sql(`select email from "Customer" where cpf='16899535009'`),'antigo@teste.com');
// saiu e entra de novo só com e-mail e senha
await p.goto(BASE+'/perfil'); await wait(p,1500);
await p.click('button:has-text("Sair da conta")'); await p.waitForURL('**/entrar'); await wait(p,1500);
await p.fill('#c-email','antigo@teste.com'); await p.fill('#c-password','senha-antigo-1'); await submit(p,'Entrar'); await p.waitForURL('**/carteira');
// com e-mail disponível, CPF + telefone não redefinem mais uma senha existente (o caminho é "Esqueci minha senha" por e-mail)
await p.goto(BASE+'/perfil'); await wait(p,1500);
await p.click('button:has-text("Sair da conta")'); await p.waitForURL('**/entrar'); await wait(p,1500);
await p.click('text=Crie seu e-mail e senha');
await p.fill('#r-cpf','168.995.350-09'); await p.fill('#r-phone','11955554444'); await p.fill('#r-email','antigo@teste.com'); await p.fill('#r-password','outra-senha-22');
await submit(p,'Criar acesso e entrar'); await p.waitForSelector('text=já tem senha');
const p2 = await fresh(); await p2.goto(BASE+'/entrar'); await wait(p2,1500);
await p2.fill('#c-email','antigo@teste.com'); await p2.fill('#c-password','outra-senha-22'); await submit(p2,'Entrar'); await p2.waitForSelector('text=E-mail ou senha incorretos.');
console.log('5. cliente antigo cria o acesso, entra só com e-mail e senha e não redefine mais só com CPF + telefone OK');

// 6. limite de tentativas por e-mail
const p3 = await fresh(); await p3.goto(BASE+'/entrar'); await wait(p3,1500);
let blocked = 0;
for (let i=1;i<=10;i++){ await p3.fill('#c-email','lucas@teste.com'); await p3.fill('#c-password','errada-'+i); await submit(p3,'Entrar'); await p3.waitForSelector('[role=alert]'); await wait(p3,300); if ((await p3.textContent('[role=alert]')).includes('Muitas')) { blocked=i; break; } }
assert.ok(blocked>0 && blocked<=10, 'deve bloquear: '+blocked);
console.log('6. limite de tentativas OK (bloqueou na', blocked+'ª)');
sql('TRUNCATE "RateLimit"');

// 7. sem rolagem lateral no celular nos três modos
p = await fresh({width:360,height:740}); await p.goto(BASE+'/entrar'); await wait(p,1500);
const ov = async()=>p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
assert.ok(await ov()<=0);
await p.click('[role=tab]:has-text("Criar conta")'); await wait(p,300); assert.ok(await ov()<=0);
await p.screenshot({path:'cli-criar.png'});
await p.click('[role=tab]:has-text("Entrar")'); await p.click('text=Crie seu e-mail e senha'); await wait(p,300); assert.ok(await ov()<=0);
await p.screenshot({path:'cli-recuperar.png'});
console.log('7. telas de entrar/criar/recuperar sem rolagem lateral no celular OK');

sql(`delete from "Customer" where name like 'e2e10%'`);
await browser.close();
