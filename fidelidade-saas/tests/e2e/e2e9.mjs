import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { execSync, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const DB='postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql=(q)=>execFileSync('psql',[DB,'-At','-c',q]).toString().trim(); // sem shell: o hash de senha tem $
sql('TRUNCATE "RateLimit"'); sql('delete from "AdminLog"'); sql('delete from "AdminUser"'); sql('update "Restaurant" set "guideDoneAt"=now()');
const origHash = sql(`select "passwordHash" from "Restaurant" where email='ze@burger.com'`); // sem shell: o hash tem $
const origStatus = sql(`select "subscriptionStatus" from "Restaurant" where email='ze@burger.com'`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const wait=(p,t)=>p.waitForTimeout(t);
const ctx = await browser.newContext({ viewport:{width:1366,height:900} });
await ctx.addInitScript(()=>localStorage.setItem('fz_intro_v1','1'));
const a = await ctx.newPage();
a.on('pageerror',e=>console.log('PAGEERROR',e.message));

// ---- convite criado pelo script
const out = execSync(`cd ${fileURLToPath(new URL('../..', import.meta.url))} && DATABASE_URL=${DB}?schema=public APP_URL=${BASE} npx tsx scripts/admin-invite.ts admin@teste.com "Admin Teste"`).toString();
const link = out.match(/http\S+\/admin\/convite\/\S+/)[0];
assert.equal(sql(`select (select count(*) from "AdminUser" where email='admin@teste.com' and "passwordHash" is null and "inviteTokenHash" is not null)`),'1');
assert.ok(!sql(`select "inviteTokenHash" from "AdminUser"`).includes(link.split('/').pop()), 'o token não pode estar no banco, só o hash');
console.log('1. convite criado pelo script (só o hash fica no banco) OK');

// ---- acesso negado sem login
await a.goto(BASE+'/admin'); await a.waitForURL('**/admin/entrar');
await a.goto(BASE+'/admin/assinantes'); await a.waitForURL('**/admin/entrar');
const csv = await ctx.request.get(BASE+'/admin/assinantes/'+rid, { maxRedirects:0 });
assert.ok([302,303,307,308].includes(csv.status()));
// dono logado também não entra no admin
await a.goto(BASE+'/login'); await wait(a,2200);
await a.fill('#email','ze@burger.com'); await a.fill('#password','senha-segura-1');
await a.click('button:has-text("Entrar")'); await a.waitForURL('**/dashboard');
await a.goto(BASE+'/admin'); await a.waitForURL('**/admin/entrar');
await a.goto(BASE+'/dashboard');
await a.click('button:has-text("Sair")'); await a.waitForURL('**/login');
console.log('2. /admin exige login de administrador (nem o dono entra) OK');

// ---- aceitar convite
await a.goto(link); await wait(a,2000);
await a.fill('#password','somenteletrasaqui'); await a.fill('#confirm','somenteletrasaqui'); await a.click('button:has-text("Criar senha")');
await a.waitForSelector('text=letras e números'); await wait(a,800);
await a.fill('#password','SenhaAdmin2026'); await a.fill('#confirm','SenhaAdmin2027'); await a.click('button:has-text("Criar senha")');
await a.waitForSelector('text=não são iguais'); await wait(a,800);
await a.fill('#password','SenhaAdmin2026'); await a.fill('#confirm','SenhaAdmin2026'); await a.click('button:has-text("Criar senha")');
await a.waitForURL('**/admin'); await a.waitForSelector('h1:has-text("Visão geral")');
await a.waitForSelector('text=Assinantes ativos'); await a.waitForSelector('text=Receita mensal'); await a.waitForSelector('text=Precisam de atenção');
await a.screenshot({path:'admin-home.png', fullPage:true});
assert.equal(sql(`select ("inviteTokenHash" is null)::text from "AdminUser"`),'true');
const sg = a.locator('svg[aria-label^="Cadastros por dia"] rect[aria-label]').last();
await sg.scrollIntoViewIfNeeded(); await sg.hover();
await a.waitForSelector('[role=tooltip]'); assert.match(await a.locator('[role=tooltip]').innerText(), /cadastro/);
assert.equal(await a.locator('svg[aria-label^="Cadastros por dia"] path[stroke="#2150C9"]').count(), 1, 'cadastros por dia no gráfico de área padrão');
console.log('3. convite aceito, senha definida e visão geral OK');

// convite só vale uma vez
const b = await (await browser.newContext()).newPage();
await b.goto(link); await wait(b,1500);
await b.waitForSelector('text=não é mais válido');
await b.goto(BASE+'/admin/convite/token-inventado'); await b.waitForSelector('text=não é mais válido');
console.log('4. convite usado ou inventado não funciona OK');

// ---- sair, errar senha, limite de tentativas, entrar
await a.click('button:has-text("Sair")'); await a.waitForURL('**/admin/entrar');
for (let i=0;i<6;i++){ await a.fill('#email','admin@teste.com'); await a.fill('#password','errada'+i); await a.click('button:has-text("Entrar")'); await a.waitForSelector('[role=alert]'); await wait(a,500); }
await a.fill('#email','admin@teste.com'); await a.fill('#password','SenhaAdmin2026'); await a.click('button:has-text("Entrar")');
await a.waitForSelector('text=Muitas tentativas');
sql('TRUNCATE "RateLimit"');
await a.fill('#email','admin@teste.com'); await a.fill('#password','SenhaAdmin2026'); await a.click('button:has-text("Entrar")');
await a.waitForURL('**/admin');
console.log('5. login: senha errada, limite de tentativas e entrada OK');

// ---- lista de assinantes
await a.goto(BASE+'/admin/assinantes'); await wait(a,2000);
await a.waitForSelector('tr:has-text("ze@burger.com")');
await a.fill('input[name=q]','burger'); await a.click('button:has-text("Buscar")');
await a.waitForSelector('tr:has-text("ze@burger.com")');
await a.goto(BASE+'/admin/assinantes?status=CANCELED'); await wait(a,1500);
await a.waitForSelector('text=Nenhum assinante encontrado');
await a.screenshot({path:'admin-lista.png'});
console.log('6. lista, busca e filtro por status OK');

// ---- ficha: status, dados, senha, nota, guia
await a.goto(BASE+'/admin/assinantes/'+rid); await wait(a,2200);
await a.waitForSelector('h1:has-text("Burger do Zé")');
await a.click('button:has-text("Suspender acesso")'); await a.waitForSelector('[role=dialog]');
await a.click('[role=dialog] button:has-text("Voltar")');
assert.equal(sql(`select "subscriptionStatus" from "Restaurant" where id='${rid}'`),'ACTIVE','voltar não altera');
await a.click('button:has-text("Suspender acesso")'); await a.fill('#status-reason','teste de cobrança');
await a.click('[role=dialog] button:has-text("Sim, suspender acesso")');
await a.waitForSelector('text=Acesso suspenso.'); await a.click('[role=dialog] button:has-text("Fechar")');
assert.equal(sql(`select "subscriptionStatus" from "Restaurant" where id='${rid}'`),'PAST_DUE');
// o dono inadimplente volta para o pagamento
const o = await (await browser.newContext({viewport:{width:1280,height:900}})).newPage();
await o.goto(BASE+'/login'); await wait(o,2000);
await o.fill('#email','ze@burger.com'); await o.fill('#password','senha-segura-1'); await o.click('button:has-text("Entrar")');
await o.waitForURL('**/dashboard'); await o.goto(BASE+'/dashboard/caixa'); await o.waitForURL('**/pagamento**');
await a.click('button:has-text("Reativar")'); await a.fill('#status-reason','pago por Pix');
await a.click('[role=dialog] button:has-text("Sim, liberar acesso")');
await a.waitForSelector('text=Acesso liberado.'); await a.click('[role=dialog] button:has-text("Fechar")');
await o.goto(BASE+'/dashboard/caixa'); await wait(o,2000); await o.waitForSelector('text=Gerar pontos');
console.log('7. status da assinatura muda o acesso do dono OK');

// ---- novo assinante + cancelar com botão + conta de teste
await a.goto(BASE+'/admin/assinantes'); await wait(a,1500);
await a.click('text=+ Novo assinante'); await a.waitForURL('**/admin/assinantes/novo'); await wait(a,1500);
await a.fill('#n-name','Padaria Nova'); await a.fill('#n-email','Nova@Padaria.com'); await a.fill('#n-phone','11912345678');
await a.check('input[name=isTest]');
await a.click('button:has-text("Criar conta")');
await a.waitForSelector('[data-testid=new-password]');
const newPw = (await a.locator('[data-testid=new-password]').innerText()).trim();
assert.equal(sql(`select count(*) from "Restaurant" where email='nova@padaria.com' and "isTest"=true and "subscriptionStatus"='ACTIVE'`),'1');
assert.equal(sql(`select count(*) from "Unit" u join "Restaurant" r on r.id=u."restaurantId" where r.email='nova@padaria.com'`),'1');
await a.goto(BASE+'/admin/assinantes/novo'); await wait(a,1500);
await a.fill('#n-name','Outra'); await a.fill('#n-email','nova@padaria.com'); await a.fill('#n-phone','11912345678');
await a.click('button:has-text("Criar conta")'); await a.waitForSelector('text=Já existe');
const o3 = await (await browser.newContext()).newPage();
await o3.goto(BASE+'/login'); await wait(o3,2000);
await o3.fill('#email','nova@padaria.com'); await o3.fill('#password',newPw); await o3.click('button:has-text("Entrar")'); await o3.waitForURL('**/dashboard');
sql(`update "Restaurant" set "guideDoneAt"=now() where email='nova@padaria.com'`);
await o3.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await wait(o3,1500);
await o3.fill('#pw-cur',newPw); await o3.fill('#pw-new','minha-nova-senha-9'); await o3.fill('#pw-conf','minha-nova-senha-9');
await o3.click('button:has-text("Trocar senha")'); await o3.waitForSelector('text=Senha alterada.');
await o3.close();
const nid = sql(`select id from "Restaurant" where email='nova@padaria.com'`);
await a.goto(BASE+'/admin'); await wait(a,1500);
await a.waitForSelector('text=Contas de teste'); await a.waitForSelector('text=Padaria Nova');
await a.goto(BASE+'/admin/assinantes/'+nid); await wait(a,1500);
await a.waitForSelector('h1 >> text=TESTE');
await a.click('button:has-text("Cancelar assinatura")'); await a.fill('#status-reason','pediu para sair');
await a.click('[role=dialog] button:has-text("Sim, cancelar assinatura")'); await a.waitForSelector('text=Assinatura cancelada.');
assert.equal(sql(`select "subscriptionStatus" from "Restaurant" where id='${nid}'`),'CANCELED');
assert.match(sql(`select detail from "AdminLog" where "restaurantId"='${nid}' and action='status'`),/pediu para sair/);
await a.screenshot({path:'admin-cancelar.png'});
sql(`delete from "Restaurant" where id='${nid}'`);
await a.goto(BASE+'/admin/assinantes/'+rid); await wait(a,2000);
console.log('7b. criar assinante, senha temporária, troca de senha do dono, conta de teste e cancelar por botão OK');

await a.fill('#e-ppr','12'); await a.click('button:has-text("Salvar dados")');
await a.waitForSelector('text=Dados salvos.');
assert.equal(sql(`select "pointsPerReal" from "Restaurant" where id='${rid}'`),'12');
await a.fill('#e-ppr','10'); await a.click('button:has-text("Salvar dados")'); await a.waitForSelector('text=Dados salvos.');
await a.click('button:has-text("Salvar dados")'); await a.waitForSelector('text=Nada para salvar');
console.log('8. editar dados e regras (e aviso de nada a salvar) OK');

await a.fill('#note','Combinou pagamento por Pix em novembro'); await a.click('button:has-text("Salvar anotação")');
await a.waitForSelector('text=Anotação salva.');
assert.match(sql(`select "internalNote" from "Restaurant" where id='${rid}'`),/Pix em novembro/);
await a.click('button:has-text("Reabrir guia inicial")'); await wait(a,1200);
assert.equal(sql(`select ("guideDoneAt" is null)::text from "Restaurant" where id='${rid}'`),'true');
sql(`update "Restaurant" set "guideDoneAt"=now() where id='${rid}'`);
console.log('9. anotação interna e reabrir guia OK');

await a.click('button:has-text("Gerar senha temporária")');
const temp = (await a.locator('[data-testid=temp-password]').innerText()).trim();
assert.match(temp,/^[a-zA-Z2-9]{12}$/);
const o2 = await (await browser.newContext()).newPage();
await o2.goto(BASE+'/login'); await wait(o2,2000);
await o2.fill('#email','ze@burger.com'); await o2.fill('#password',temp); await o2.click('button:has-text("Entrar")'); await o2.waitForURL('**/dashboard');
await o2.close();
sql(`update "Restaurant" set "passwordHash"='${origHash}' where id='${rid}'`);
console.log('10. senha temporária gerada e funciona no login do dono OK');

// ---- suporte: entrar como o assinante
await a.goto(BASE+'/admin/assinantes/'+rid); await wait(a,2000);
await a.click('button:has-text("Entrar como este assinante")');
await a.waitForURL('**/dashboard'); await a.waitForSelector('text=Modo suporte');
await a.screenshot({path:'admin-suporte.png'});
await a.click('button:has-text("Voltar ao admin")'); await a.waitForURL('**/admin/assinantes/'+rid);
await a.goto(BASE+'/dashboard'); await a.waitForURL('**/login');
console.log('11. entrar como assinante (faixa de suporte) e voltar OK');

// ---- registro
await a.goto(BASE+'/admin/registro'); await wait(a,1800);
for (const t of ['Inadimplente','Ativa','Pontos por real: 10 → 12','Senha temporária gerada','Entrou no painel do assinante']) await a.waitForSelector(`text=${t}`);
await a.screenshot({path:'admin-registro.png'});
assert.ok(Number(sql('select count(*) from "AdminLog"'))>=8);
console.log('12. registro de ações OK');

// ---- desativar corta o acesso na hora
sql(`update "AdminUser" set active=false`);
await a.goto(BASE+'/admin'); await a.waitForURL('**/admin/entrar');
sql(`update "AdminUser" set active=true`);

// ---- celular
const mctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true });
const m = await mctx.newPage();
await m.goto(BASE+'/admin/entrar'); await wait(m,2000);
await m.fill('#email','admin@teste.com'); await m.fill('#password','SenhaAdmin2026'); await m.click('button:has-text("Entrar")'); await m.waitForURL('**/admin');
for (const u of ['/admin','/admin/assinantes','/admin/assinantes/'+rid,'/admin/registro']) {
  await m.goto(BASE+u); await wait(m,1500);
  const w = await m.evaluate(()=>[document.documentElement.scrollWidth, innerWidth]);
  assert.ok(w[0]<=w[1], `rolagem lateral em ${u}: ${w}`);
}
await m.screenshot({path:'admin-ficha-mob.png', fullPage:true});
console.log('13. desativar administrador corta o acesso; telas no celular sem rolagem lateral OK');

sql(`update "Restaurant" set "subscriptionStatus"='${origStatus}' where id='${rid}'`);
sql('delete from "AdminLog"'); sql('delete from "AdminUser"');
await browser.close(); console.log('ALL OK (administração)');
