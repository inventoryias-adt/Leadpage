import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(); delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const uid = sql(`select id from "Unit" where "restaurantId"='${rid}' order by "createdAt" limit 1`);
const cid = sql(`select id from "Customer" where phone='11999998888'`);
const svc = sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid(),'${rid}','Corte',40,5000) returning id`).split('\n')[0];
const mk = (name, phone) => sql(`insert into "Resource"(id,"restaurantId","unitId",name,phone,capacity) values (gen_random_uuid(),'${rid}','${uid}','${name}',${phone ? `'${phone}'` : 'null'},1) returning id`).split('\n')[0];
const lucas = mk('Lucas', '11988887777'), ana = mk('Ana', null);
// dias relativos a hoje em Brasília; horários 10h BRT = 13h UTC
const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const day = (n) => new Date(Date.parse(today + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const add = (res, dn, h, status = 'CONFIRMED', note = 'null') => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents",note) values (gen_random_uuid(),'${rid}','${uid}','${cid}','${svc}','${res}','${day(dn)}T${String(h + 3).padStart(2, '0')}:00:00Z','${day(dn)}T${String(h + 3).padStart(2, '0')}:40:00Z','${status}','Corte',40,5000,${note})`);
// A semana vai de segunda a domingo: no domingo, "amanhã" já é a semana seguinte, então o agendamento extra cai em ontem.
const sameWeek = new Date(Date.parse(today + 'T00:00:00Z')).getUTCDay() === 0 ? -1 : 1;
add(lucas, 0, 10); add(lucas, 0, 11, 'CANCELED'); add(ana, 0, 14); add(lucas, sameWeek, 9, 'PENDING', `'=HYPERLINK("x")'`);
const eom = new Date(Date.parse(today + 'T00:00:00Z')); // ao menos um no mês passado
add(ana, -35, 10, 'COMPLETED');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(BASE + '/login'); await p.fill('#email', 'ze@burger.com'); await p.fill('#password', 'senha-segura-1'); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard');

// 1. dia: todos
await p.goto(BASE + '/dashboard/agenda?vista=lista');
assert.equal(await p.locator('li:has-text("Corte")').count() >= 2, true);
assert.ok(await p.locator('select[aria-label=Profissional] option:has-text("Lucas")').count());
console.log('1. dia com filtro de profissionais OK');

// 2. filtrar por Lucas: só os dele, WhatsApp vai para o número dele
// (o WhatsApp abre em outra aba pelo servidor, que responde com um redirecionamento para o wa.me; aqui o redirecionamento é capturado, sem sair da máquina)
let waLocation = '';
await ctx.route('**/dashboard/agenda/whatsapp**', async (r) => {
  const res = await r.fetch({ maxRedirects: 0 });
  waLocation = res.headers()['location'] ?? '';
  await r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' });
});
const sendWa = async ({ per, prof, para } = {}) => {
  await p.click('[data-testid=whatsapp-abrir]'); await p.waitForSelector('[data-testid=whatsapp-janela]');
  if (per) await p.selectOption('#wa-per', per);
  if (prof !== undefined) await p.selectOption('#wa-prof', prof);
  if (para) await p.check(`input[name=para][value=${para}]`);
  waLocation = '';
  const [popup] = await Promise.all([ctx.waitForEvent('page'), p.click('[data-testid=whatsapp-enviar]')]);
  await popup.waitForLoadState('domcontentloaded'); await popup.close();
  assert.ok(waLocation, 'o servidor redirecionou para o WhatsApp');
  return { url: waLocation, text: decodeURIComponent(waLocation.split('text=')[1] ?? '') };
};
await p.selectOption('select[aria-label=Profissional]', { label: 'Lucas' }); await p.waitForURL('**prof=*');
const one = await sendWa();
assert.match(one.url, /^https:\/\/wa\.me\/5511988887777\?text=/);
assert.match(one.text, /^Agenda de Lucas · /); assert.match(one.text, /10h–10h40 Corte — Lucas Silva/); assert.ok(!one.text.includes('Ana'));
assert.ok(!one.text.includes('11h'), 'cancelado fora');
console.log('2. filtro por profissional + WhatsApp com o número e o texto dele OK');

// 3. Ana sem WhatsApp: a janela avisa e abre o contato livre
await p.selectOption('select[aria-label=Profissional]', { label: 'Ana' }); await p.waitForURL(`**prof=${ana}**`); // espera a agenda trocar de atendente (a janela do WhatsApp lê o atendente da página)
await p.click('[data-testid=whatsapp-abrir]'); await p.waitForSelector('[data-testid=whatsapp-janela]');
await p.waitForSelector('text=não tem WhatsApp cadastrado');
assert.ok(await p.locator('input[name=para][value=atendente]').isDisabled());
await p.click('button:has-text("Cancelar")');
const noPhone = await sendWa();
assert.match(noPhone.url, /^https:\/\/wa\.me\/\?text=/); assert.match(noPhone.text, /^Agenda de Ana · /);
console.log('3. profissional sem WhatsApp OK');

// 3b. na própria janela: todos da semana para mim; e só o Lucas, mas para outro contato (eu escolho no WhatsApp)
const week = await sendWa({ per: 'semana', prof: '' });
assert.match(week.url, /^https:\/\/wa\.me\/\?text=/); assert.match(week.text, /^Agenda · semana de /);
assert.ok(week.text.includes('com Lucas') && week.text.includes('com Ana'), 'agenda de todos, com o nome de quem atende');
const lucasToMe = await sendWa({ per: 'dia', prof: lucas, para: 'escolher' });
assert.match(lucasToMe.url, /^https:\/\/wa\.me\/\?text=/); assert.match(lucasToMe.text, /^Agenda de Lucas · /); assert.ok(!lucasToMe.text.includes('Ana'));
console.log('3b. escolher período, atendente e para quem enviar na própria janela OK');

// 4. semana agrupada por dia (hoje e outro dia da mesma semana) e mês passado
await p.selectOption('select[aria-label=Profissional]', { label: 'Todos' }); await p.waitForFunction(() => !location.search.includes('prof='));
await p.click('[data-testid=vista-grade]'); await p.waitForFunction(() => !location.search.includes('vista=lista')); // o teste começou na lista: volta ao calendário
await p.selectOption('select[aria-label=Período]', { label: 'Semana' }); await p.waitForURL('**per=semana**');
await p.waitForSelector('[data-testid=agenda-week]'); // a visão em calendário acompanha a pessoa para a semana
assert.ok(await p.locator('[data-testid=week-block]').count() >= 1);
await p.click('[data-testid=vista-lista]'); await p.waitForURL('**vista=lista**');
assert.ok(await p.locator('section[aria-label*="/"] h2').count() >= 1);
await p.selectOption('select[aria-label=Período]', { label: 'Mês passado' }); await p.waitForURL('**per=mes-passado**'); // a lista também acompanha
const lastMonth = new Date(Date.parse(today + 'T00:00:00Z')); lastMonth.setUTCDate(1); lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
const inLast = new Date(Date.parse(day(-35)) + 3 * 3600e3).toISOString().slice(0, 7) === lastMonth.toISOString().slice(0, 7);
assert.equal(await p.locator('li:has-text("Concluído")').count(), inLast ? 1 : 0, 'só entra o que é do mês passado');
console.log('4. semana agrupada por dia e mês passado OK');

// 5. CSV: baixa com o filtro, BOM, cabeçalho, sem vazar outro profissional; recado malicioso vira texto
const csvUrl = (extra) => BASE + '/dashboard/agenda/exportar?per=semana' + extra;
const get = async (u) => { const r = await ctx.request.get(u); return { r, t: await r.text() }; };
const all = await get(csvUrl(''));
assert.equal(all.r.status(), 200); assert.match(all.r.headers()['content-type'], /text\/csv/); assert.match(all.r.headers()['content-disposition'], /attachment; filename="agenda-todos-/);
assert.ok(all.t.startsWith('\uFEFFData;Início;Fim;Profissional;Serviço;Cliente;Telefone;Status'));
assert.ok(all.t.includes('Lucas') && all.t.includes('Ana'));
assert.ok(all.t.includes(`"'=HYPERLINK(""x"")"`), 'fórmula neutralizada');
const only = await get(csvUrl('&prof=' + lucas));
assert.ok(only.t.includes('Lucas') && !only.t.includes(';Ana;'));
assert.match(only.r.headers()['content-disposition'], /agenda-lucas-/);
const anon = await (await b.newContext()).request.get(csvUrl(''), { maxRedirects: 0 });
assert.ok([307, 401].includes(anon.status()), 'sem login: o middleware manda para a entrada (ou 401)');
assert.ok(!(anon.headers()['content-type'] || '').includes('text/csv'));
console.log('5. CSV com filtro, BOM, proteção de fórmula e login exigido OK');

// 6. profissional de OUTRO estabelecimento não vaza por ?prof=
const other = sql(`select id from "Resource" where "restaurantId"<>'${rid}' limit 1`);
const x = await get(csvUrl('&prof=' + (other || 'inexistente')));
assert.ok(!x.t.includes('Lucas') && !x.t.includes('Ana') || other === '', 'id alheio ou inexistente → vazio');
console.log('6. ?prof= de outro estabelecimento não vaza dados OK');

// 7. concluir pela visão da semana volta para a mesma visão
await p.goto(BASE + '/dashboard/agenda?per=semana&vista=lista'); 
await p.click('li:has-text("10:00") button:has-text("Concluir")').catch(async () => p.click('li:has-text("10h") button:has-text("Concluir")'));
await p.waitForSelector('[role=status]'); assert.match(p.url(), /per=semana/);
console.log('7. ação mantém período/filtro ao voltar OK');
await p.screenshot({ path: 'agenda-equipe.png', fullPage: true });
console.log('ALL OK (agenda por profissional)');
await b.close();
