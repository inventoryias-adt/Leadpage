import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(), category=null, "categoryOther"=null where email='ze@burger.com'`);
const get = () => sql(`select coalesce(category,'')||'|'||coalesce("categoryOther",'') from "Restaurant" where email='ze@burger.com'`);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const c = await b.newContext({ viewport: { width: 390, height: 800 } });
const p = await c.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(BASE + '/login'); await p.fill('#email', 'ze@burger.com'); await p.fill('#password', 'senha-segura-1'); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard**');
await p.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await p.waitForSelector('#i-cat'); await p.waitForTimeout(1500); // espera a hidratação

// 1. escolher a categoria já salva, com aviso ao lado do campo (sem apertar "Salvar identidade")
await p.selectOption('#i-cat', 'pizza');
await p.waitForSelector('text=✓ Categoria salva');
assert.equal(get(), 'pizza|');
console.log('1. escolher a categoria salva na hora e avisa "✓ Categoria salva" OK');

// 2. salvar o resto do formulário não apaga a escolha na tela
await p.fill('#i-ig', 'burgerdoze');
await p.click('button:has-text("Salvar identidade")'); await p.waitForSelector('text=Identidade da marca salva.');
assert.equal(await p.inputValue('#i-cat'), 'pizza', 'a opção continua marcada depois de salvar o formulário');
assert.equal(get(), 'pizza|');
await p.reload(); await p.waitForSelector('#i-cat'); await p.waitForTimeout(1500);
assert.equal(await p.inputValue('#i-cat'), 'pizza');
console.log('2. depois de "Salvar identidade" e ao recarregar, a categoria continua escolhida OK');

// 3. "Outros": o texto salva ao sair do campo
await p.selectOption('#i-cat', 'outros'); await p.waitForSelector('#i-other');
await p.fill('#i-other', 'Doceria fina'); await p.press('#i-other', 'Tab');
await p.waitForSelector('text=✓ Categoria salva');
assert.equal(get(), 'outros|Doceria fina');
await p.reload(); await p.waitForSelector('#i-cat'); await p.waitForTimeout(1500);
assert.equal(await p.inputValue('#i-cat'), 'outros'); assert.equal(await p.inputValue('#i-other'), 'Doceria fina');
console.log('3. "Outros": o texto salva ao sair do campo e volta ao recarregar OK');

// 4. trocar para uma fixa limpa o texto; voltar a "Selecione" limpa a categoria
await p.selectOption('#i-cat', 'cafe'); await p.waitForSelector('text=✓ Categoria salva');
assert.equal(get(), 'cafe|');
await p.selectOption('#i-cat', ''); await p.waitForFunction(() => document.querySelector('[role=status]')?.textContent?.includes('✓'));
await p.waitForTimeout(500);
assert.equal(get(), '|');
console.log('4. trocar de categoria e limpar também salvam OK');
await b.close();
console.log('ALL OK (categoria salva na hora)');
