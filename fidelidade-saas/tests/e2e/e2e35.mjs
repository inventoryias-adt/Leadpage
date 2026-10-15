import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now()`);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1100, height: 800 } });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); localStorage.setItem('fz_guide_v1', '1'); });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));

// 1. cabeçalhos de segurança
const r = await ctx.request.get(BASE + '/entrar');
const h = r.headers();
assert.equal(h['x-frame-options'], 'DENY'); assert.equal(h['x-content-type-options'], 'nosniff');
assert.equal(h['referrer-policy'], 'strict-origin-when-cross-origin'); assert.match(h['permissions-policy'], /geolocation=\(self\)/); assert.match(h['strict-transport-security'], /max-age=31536000/);
console.log('1. cabeçalhos de segurança em todas as respostas OK');

// 2. sem sessão, cada área manda para o seu login (antes mesmo da página rodar)
const noFollow = (path, cookie) => ctx.request.get(BASE + path, { maxRedirects: 0, headers: cookie ? { cookie } : {} });
for (const [path, to] of [['/dashboard', '/login'], ['/dashboard/caixa', '/login'], ['/admin', '/admin/entrar'], ['/perfil', '/entrar?next=%2Fperfil'], ['/carteira', '/entrar?next=%2Fcarteira'], ['/avisos', '/entrar?next=%2Favisos']]) {
  const x = await noFollow(path); assert.equal(x.status(), 307, path); assert.ok(x.headers().location.endsWith(to), `${path} → ${x.headers().location}`);
}
for (const path of ['/', '/entrar', '/login', '/admin/entrar', '/lugares', '/termos']) assert.equal((await noFollow(path)).status(), 200, path + ' continua público');
// cookie falsificado não vale
for (const [path, ck] of [['/dashboard', 'rs_session=abc.def.ghi'], ['/perfil', 'cs_session=invalido'], ['/admin', 'ad_session=x.y.z']]) assert.equal((await noFollow(path, ck)).status(), 307, path + ' com cookie falso');
console.log('2. sem sessão (ou com cookie falso) cada área vai para o login; páginas públicas seguem abertas OK');

// 3. sessão do tipo errado não abre a área dos outros
await p.goto(BASE + '/entrar'); await p.fill('#c-email', 'lucas@teste.com'); await p.fill('#c-password', 'senha-cliente-1'); await p.click('button[type=submit]'); await p.waitForURL('**/carteira**');
const cookies = await ctx.cookies(); const cs = cookies.find((c) => c.name === 'cs_session');
assert.equal((await noFollow('/perfil', `cs_session=${cs.value}`)).status(), 200, 'cliente logado abre o perfil');
assert.equal((await noFollow('/dashboard', `rs_session=${cs.value}`)).status(), 307, 'token de cliente não vale no painel do dono');
assert.equal((await noFollow('/admin', `ad_session=${cs.value}`)).status(), 307, 'token de cliente não vale na administração');
console.log('3. sessão válida passa; token de outro tipo não abre o painel do dono nem a administração OK');

// 4. dono logado continua entrando; 404 próprio
const o = await (await b.newContext({ viewport: { width: 1100, height: 800 } })).newPage();
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard**');
await o.goto(BASE + '/dashboard/caixa'); await o.waitForSelector('#amount');
// o servidor de desenvolvimento compila a página 404 na primeira visita e pode derrubar a conexão nessa hora: tenta de novo
let nf;
for (let i = 0; i < 3; i++) {
  try { nf = await ctx.request.get(BASE + '/nada-aqui'); break; } catch (e) { if (i === 2) throw e; await new Promise((r) => setTimeout(r, 3000)); }
}
assert.equal(nf.status(), 404);
await p.goto(BASE + '/nada-aqui'); await p.waitForSelector('text=Página não encontrada'); await p.waitForSelector('a:has-text("Ver lugares")');
console.log('4. dono logado segue entrando no painel; página 404 própria com a marca OK');
await b.close();
console.log('ALL OK (segurança de rotas, cabeçalhos e 404)');
