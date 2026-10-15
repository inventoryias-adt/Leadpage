import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
// sem serviços cadastrados e sem categoria
sql(`truncate "RateLimit"; delete from "Booking" where "restaurantId"='${rid}'; delete from "ResourceService" where "serviceId" in (select id from "Service" where "restaurantId"='${rid}'); delete from "Service" where "restaurantId"='${rid}'; update "Restaurant" set "guideDoneAt"=now(), category=null, "categoryOther"=null where id='${rid}'`);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const c = await b.newContext({ viewport: { width: 1200, height: 900 } });
const p = await c.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(BASE + '/login'); await p.fill('#email', 'ze@burger.com'); await p.fill('#password', 'senha-segura-1'); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard**');
await p.goto(BASE + '/dashboard/configuracoes'); await p.waitForSelector('#i-cat'); await p.waitForTimeout(1500);
const agendaTab = () => p.locator('nav a[href="/dashboard/agenda"]:visible').count();
assert.equal(await agendaTab(), 0, 'sem serviços e sem categoria de atendimento, a aba não aparece');
assert.equal(await p.locator('text=Esse tipo de negócio costuma atender com hora marcada').count(), 0);

// 1. escolher uma categoria de atendimento libera a Agenda e avisa na hora
await p.selectOption('#i-cat', 'barbearia');
await p.waitForSelector('text=✓ Categoria salva');
await p.waitForSelector('text=Esse tipo de negócio costuma atender com hora marcada');
await p.waitForFunction(() => document.querySelectorAll('nav a[href="/dashboard/agenda"]').length > 0, null, { timeout: 8000 });
console.log('1. barbearia: aviso ao lado da categoria e aba Agenda liberada no menu OK');

// 2. o link abre a seção da agenda já aberta; a página da agenda orienta cadastrar serviço
await p.click('text=Configurar a agenda');
await p.waitForSelector('#agenda-conteudo[open]');
await p.goto(BASE + '/dashboard/agenda');
assert.equal(await p.locator('text=Cadastre ao menos um serviço').count(), 0, 'já existe o serviço padrão');
await p.waitForSelector('h1:has-text("Agenda")');
console.log('2. o link abre a agenda aberta e a página da Agenda já funciona (serviço padrão) OK');

// 3. recarregar: seção da agenda aberta como "Recomendado" para esse tipo de negócio
await p.goto(BASE + '/dashboard/configuracoes'); await p.waitForSelector('#agenda-conteudo');
assert.equal(await p.locator('#agenda-conteudo[open]').count(), 1);
assert.ok(await p.locator('#agenda-conteudo >> text=1 serviço').count());
console.log('3. na configuração, a agenda vem aberta com o serviço padrão OK');

// 4. categoria sem atendimento: some o aviso e (sem serviços) a aba
await p.waitForTimeout(1200);
await p.selectOption('#i-cat', 'pizza'); await p.waitForSelector('text=✓ Categoria salva');
assert.equal(await p.locator('text=Esse tipo de negócio costuma atender com hora marcada').count(), 0);
assert.ok(await p.locator('nav a[href="/dashboard/agenda"]').count(), 'com serviço cadastrado (o padrão), a aba continua');
console.log('4. pizza: o aviso some; a aba continua porque já há um serviço cadastrado OK');
await b.close();
console.log('ALL OK (categoria libera a agenda)');
