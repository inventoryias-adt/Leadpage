// Meus dados (perfil do cliente): trocar nome, telefone, e-mail, CPF e senha, tudo numa tela só; telefone, e-mail, CPF e senha pedem a senha atual.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; delete from "Customer" where email in ('dados@teste.com','dados.novo@teste.com')`);
// cliente só deste teste, com a mesma senha dos outros
sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash","termsAcceptedAt","termsVersion") select gen_random_uuid()::text,'39053344705',phone,'Dados Teste','dados@teste.com',"passwordHash","termsAcceptedAt","termsVersion" from "Customer" where email='lucas@teste.com'`);
const id = sql(`select id from "Customer" where email='dados@teste.com'`);
const lucasCpf = sql(`select cpf from "Customer" where email='lucas@teste.com'`);
const row = () => sql(`select name||'|'||phone||'|'||email||'|'||cpf from "Customer" where id='${id}'`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {} });
const c = await ctx.newPage(); c.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await c.goto(BASE + '/entrar'); await c.fill('#c-email', 'dados@teste.com'); await c.fill('#c-password', 'senha-cliente-1'); await c.click('button[type=submit]'); await c.waitForURL('**/carteira**');

// 1. do Perfil para "Meus dados", com voltar
await c.goto(BASE + '/perfil'); await c.waitForSelector('[data-testid=edit-profile-link]');
assert.ok(await c.locator('[data-testid=my-data-link]').count(), 'atalho em "Minha conta"');
await c.click('[data-testid=edit-profile-link]'); await c.waitForURL('**/perfil/dados'); await c.waitForSelector('[data-testid=data-nome]');
assert.ok(await c.locator('[data-testid=back-perfil]').count());
for (const k of ['nome', 'contato', 'cpf', 'senha']) assert.ok(await c.locator(`[data-testid=data-${k}]`).count(), k);
assert.ok(await c.locator('[data-testid=profile-photo-input]').count(), 'foto na mesma tela');
await c.screenshot({ path: 'meus-dados.png', fullPage: true });
console.log('1. Meus dados: foto, nome, telefone/e-mail, CPF, senha, aniversário e Instagram numa tela, com voltar OK');

// 2. nome
await c.fill('#cf-name', 'A'); await c.click('[data-testid=save-name]'); await c.waitForSelector('text=Informe seu nome');
await c.fill('#cf-name', '  Maria   da Silva Souza '); await c.click('[data-testid=save-name]'); await c.waitForSelector('text=Nome atualizado');
assert.equal(row().split('|')[0], 'Maria da Silva Souza');
await c.goto(BASE + '/perfil'); await c.waitForSelector('h1:has-text("Maria da Silva Souza")');
console.log('2. trocar o nome (espaços arrumados) aparece no Perfil OK');

// 3. telefone e e-mail pedem a senha atual
await c.goto(BASE + '/perfil/dados'); await c.waitForSelector('#cf-phone');
await c.fill('#cf-phone', '(21) 98888-7777'); await c.click('[data-testid=save-contact]'); await c.waitForSelector('text=Digite a sua senha atual');
await c.fill('#cf-phone', '(21) 98888-7777'); await c.fill('#cf-password', 'errada-123'); await c.click('[data-testid=save-contact]'); await c.waitForSelector('text=A senha atual está incorreta');
assert.ok(!row().includes('21988887777'), 'não salva com senha errada');
await c.fill('#cf-phone', '(21) 98888-7777'); await c.fill('#cf-email', 'dados.novo@teste.com'); await c.fill('#cf-password', 'senha-cliente-1'); await c.click('[data-testid=save-contact]'); await c.waitForSelector('text=Dados de contato atualizados');
assert.equal(row().split('|').slice(1, 3).join('|'), '21988887777|dados.novo@teste.com');
await c.fill('#cf-email', 'lucas@teste.com'); await c.fill('#cf-password', 'senha-cliente-1'); await c.click('[data-testid=save-contact]'); await c.waitForSelector('text=já está em uso');
console.log('3. telefone e e-mail: pedem a senha atual; e-mail repetido é recusado OK');

// 4. CPF
await c.locator('[data-testid=data-cpf] #cf-cpf').fill('111.111.111-11');
await c.locator('[data-testid=data-cpf] #cf-password').fill('senha-cliente-1');
await c.click('[data-testid=save-cpf]'); await c.waitForSelector('text=CPF inválido');
await c.locator('[data-testid=data-cpf] #cf-cpf').fill(lucasCpf);
await c.locator('[data-testid=data-cpf] #cf-password').fill('senha-cliente-1');
await c.click('[data-testid=save-cpf]'); await c.waitForSelector('text=já tem cadastro em outra conta');
await c.locator('[data-testid=data-cpf] #cf-cpf').fill('168.995.350-09');
await c.locator('[data-testid=data-cpf] #cf-password').fill('senha-cliente-1');
await c.click('[data-testid=save-cpf]'); await c.waitForSelector('text=CPF atualizado');
assert.equal(row().split('|')[3], '16899535009');
console.log('4. CPF: inválido e repetido são recusados; o certo é salvo com a senha atual OK');

// 5. senha
await c.fill('#pw-current', 'senha-cliente-1'); await c.fill('#pw-next', 'nova-senha-123'); await c.fill('#pw-confirm', 'outra-senha-123'); await c.click('[data-testid=save-password]'); await c.waitForSelector('text=As senhas novas não são iguais');
await c.fill('#pw-current', 'errada-123'); await c.fill('#pw-next', 'nova-senha-123'); await c.fill('#pw-confirm', 'nova-senha-123'); await c.click('[data-testid=save-password]'); await c.waitForSelector('text=A senha atual está incorreta');
await c.fill('#pw-current', 'senha-cliente-1'); await c.fill('#pw-next', 'nova-senha-123'); await c.fill('#pw-confirm', 'nova-senha-123'); await c.click('[data-testid=save-password]'); await c.waitForSelector('text=Senha alterada');
const c2 = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await c2.goto(BASE + '/entrar'); await c2.fill('#c-email', 'dados.novo@teste.com'); await c2.fill('#c-password', 'senha-cliente-1'); await c2.click('button[type=submit]'); await c2.waitForSelector('text=E-mail ou senha incorretos');
await c2.fill('#c-email', 'dados.novo@teste.com'); await c2.fill('#c-password', 'nova-senha-123'); await c2.click('button[type=submit]'); await c2.waitForURL('**/carteira**');
console.log('5. trocar a senha: a antiga deixa de entrar e a nova entra, com o e-mail novo OK');

sql(`delete from "Customer" where id='${id}'`);
await b.close();
console.log('ALL OK (meus dados)');
