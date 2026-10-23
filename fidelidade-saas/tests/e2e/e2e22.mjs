import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const MAIL = process.env.DEV_MAIL_FILE || '/tmp/dev-mail.jsonl';
const week = JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: '09:00', close: '18:00' })));
sql(`truncate "RateLimit"; update "Restaurant" set "guideDoneAt"=now(),"bookingAutoConfirm"=true,"bookingMinNoticeMin"=0,"bookingMaxDaysAhead"=30,"bookingCancelHours"=2,"pointsPerReal"=10,"bookingNotifyEmail"=null; delete from "Booking"; delete from "ResourceService"; delete from "Service"; delete from "Resource"; delete from "Image" where id in (select "photoImageId" from "Resource" where "photoImageId" is not null); update "Unit" set "openingSchedule"='${week}'::jsonb`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
writeFileSync((process.env.TMPDIR || '/tmp') + '/foto.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
if (existsSync(MAIL)) rmSync(MAIL);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const octx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await octx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const o = await octx.newPage(); o.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await o.goto(BASE + '/login'); await o.fill('#email', 'ze@burger.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard');
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForSelector('#agenda');
for (const [n, d, p] of [['Corte', '40', '50,00'], ['Sobrancelha', '15', '20,00'], ['Pé', '20', '30,00']]) {
  await o.fill('#sv-name', n); await o.fill('#sv-dur', d); await o.fill('#sv-price', p);
  await o.click('#agenda button:has-text("Adicionar serviço")'); await o.waitForSelector(`#agenda li:has-text("${n}")`);
}
await o.reload(); await o.waitForSelector('#agenda');

// 1. Lucas: foto, contato, escala própria (ter a sex, 10–16h), Corte em 45 min e Sobrancelha no padrão
await o.click('summary:has-text("Adicionar profissional ou vaga")');
const F = 'form:has(#st-novo-name)';
await o.fill('#st-novo-name', 'Lucas'); await o.fill('#st-novo-email', 'lucas.barbeiro@teste.com'); await o.fill('#st-novo-phone', '11988887777');
await o.setInputFiles(`${F} input[type=file]`, (process.env.TMPDIR || '/tmp') + '/foto.png'); await o.waitForSelector(`${F} >> text=Trocar foto`);
await o.uncheck(`${F} input[name=followUnit]`);
await o.fill(`${F} #st-novo-ho-2`, '10:00'); await o.fill(`${F} #st-novo-hc-2`, '16:00');
await o.click(`${F} button[aria-label^="Repetir o horário de Terça"]`);
for (const dia of ['Segunda-feira', 'Sábado', 'Domingo']) await o.check(`${F} li:has-text("${dia}") input[type=checkbox]`);
await o.check(`${F} input[name=svc][value="${sql(`select id from "Service" where name='Corte'`)}"]`);
await o.fill(`${F} input[name="dur_${sql(`select id from "Service" where name='Corte'`)}"]`, '45');
await o.check(`${F} input[name=svc][value="${sql(`select id from "Service" where name='Sobrancelha'`)}"]`);
await o.click(`${F} button:has-text("Adicionar profissional")`); await o.waitForSelector('#agenda li:has-text("Lucas")');
assert.equal(sql(`select email||'|'||phone||'|'||("photoImageId" is not null)::text from "Resource" where name='Lucas'`), 'lucas.barbeiro@teste.com|11988887777|true');
const sch = JSON.parse(sql(`select schedule from "Resource" where name='Lucas'`));
assert.deepEqual(sch.filter((d) => d.closed).map((d) => d.day).sort(), [0, 1, 6]);
assert.deepEqual(sch.find((d) => d.day === 3), { day: 3, closed: false, open: '10:00', close: '16:00' });
assert.equal(sql(`select string_agg(s.name||':'||coalesce(rs."durationMin"::text,'padrão'),',' order by s.name) from "ResourceService" rs join "Service" s on s.id=rs."serviceId" join "Resource" r on r.id=rs."resourceId" where r.name='Lucas'`), 'Corte:45,Sobrancelha:padrão');
console.log('1. Lucas: foto, contato, escala ter–sex 10–16h, Corte 45 min e Sobrancelha no padrão OK');

// 2. Ana: segue a unidade; Corte em 60 min e Pé
await o.reload(); await o.waitForSelector('#agenda');
await o.click('summary:has-text("Adicionar profissional ou vaga")');
const G = 'form:has(#st-novo-name)';
await o.fill('#st-novo-name', 'Ana');
await o.check(`${G} input[name=svc][value="${sql(`select id from "Service" where name='Corte'`)}"]`); await o.fill(`${G} input[name="dur_${sql(`select id from "Service" where name='Corte'`)}"]`, '60');
await o.check(`${G} input[name=svc][value="${sql(`select id from "Service" where name='Pé'`)}"]`);
await o.click(`${G} button:has-text("Adicionar profissional")`); await o.waitForSelector('#agenda li:has-text("Ana")');
assert.equal(sql(`select (schedule is null)::text from "Resource" where name='Ana'`), 'true');
await o.screenshot({ path: 'eq-config.png', fullPage: false });
console.log('2. Ana: segue o horário da unidade, Corte 60 min e Pé OK');

// 3. editar: renomear e tirar a foto
await o.reload(); await o.waitForSelector('#agenda');
await o.click('#agenda li:has-text("Lucas") summary:has-text("Editar")');
await o.fill('#agenda li:has-text("Lucas") input[name=name]', 'Lucas Barbeiro');
await o.click('#agenda li:has-text("Lucas") summary:has-text("Mais opções")'); await o.check('#agenda li:has-text("Lucas") input[name=removePhoto]');
await o.click('#agenda li:has-text("Lucas") button:has-text("Salvar profissional")'); await o.waitForSelector('#agenda li:has-text("Lucas Barbeiro")');
assert.equal(sql(`select ("photoImageId" is null)::text from "Resource" where name='Lucas Barbeiro'`), 'true');
await o.evaluate(() => document.querySelectorAll('#agenda details').forEach((d) => { d.open = true; })); // reabre e volta a ligar a foto para os próximos passos
await o.setInputFiles('#agenda li:has-text("Lucas Barbeiro") input[type=file]', (process.env.TMPDIR || '/tmp') + '/foto.png');
await o.click('#agenda li:has-text("Lucas Barbeiro") button:has-text("Salvar profissional")'); await o.waitForTimeout(1200);
assert.equal(sql(`select ("photoImageId" is not null)::text from "Resource" where name='Lucas Barbeiro'`), 'true');
console.log('3. editar: nome, remover e trocar a foto OK');

// 4. cliente escolhe o profissional
const corte = sql(`select id from "Service" where name='Corte'`);
const lctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await lctx.addInitScript(() => localStorage.setItem('fz_intro_v1', '1'));
const l = await lctx.newPage(); l.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await l.goto(BASE + '/entrar'); await l.fill('#c-email', 'lucas@teste.com'); await l.fill('#c-password', 'senha-cliente-1'); await l.click('button[type=submit]'); await l.waitForURL('**/carteira**');
await l.goto(`${BASE}/lugar/${rid}/agendar?servico=${corte}`); await l.waitForSelector('text=Com quem?');
const quem = await l.locator('section[aria-labelledby=quem] a').allInnerTexts();
assert.ok(quem.some((t) => /Qualquer/.test(t)) && quem.some((t) => /Lucas Barbeiro/.test(t)) && quem.some((t) => /Ana/.test(t)), `chips de profissionais: ${quem}`);
assert.ok(await l.locator('section[aria-labelledby=quem] img').count() >= 1, 'a foto aparece');
await l.locator('section[aria-labelledby=quem] a:has-text("Lucas Barbeiro")').click(); await l.waitForSelector('section[aria-labelledby=quem] a[aria-current=true]:has-text("Lucas Barbeiro")');
assert.ok(await l.locator('section[aria-labelledby=dia] span[aria-label$="fechado"]').count() >= 4, 'dias de folga do Lucas aparecem fechados');
const pickDay = async () => {
  const links = l.locator('section[aria-labelledby=dia] ul.chip-row li a');
  const n = await links.count();
  for (let i = 0; i < n; i++) { const t = await links.nth(i).innerText(); if (!/Hoje/.test(t)) { await links.nth(i).click(); return; } }
};
await pickDay(); await l.waitForSelector('section[aria-labelledby=dia] a[aria-current=date]:not(:has-text("Hoje"))');
const times = await l.locator('ul.grid a').allInnerTexts();
assert.equal(times[0], '10:00'); assert.equal(times[times.length - 1], '15:00', '45 min dentro da escala até 16h: o último começa às 15h');
await l.click('ul.grid a:has-text("10:00")'); await l.waitForSelector('text=com Lucas Barbeiro'); await l.waitForSelector('text=· 45 min');
assert.ok(await l.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sem rolagem lateral');
await l.screenshot({ path: 'eq-cliente.png', fullPage: true });
await l.click('button:has-text("Confirmar agendamento")'); await l.waitForURL('**/perfil/agendamentos**'); await l.waitForSelector('text=com Lucas Barbeiro');
assert.equal(sql(`select r.name||'|'||b."durationMin"||'|'||to_char(b."endsAt"-b."startsAt",'HH24:MI') from "Booking" b join "Resource" r on r.id=b."resourceId"`), 'Lucas Barbeiro|45|00:45');
console.log('4. cliente escolhe o Lucas: folgas fechadas, horários só na escala, 45 min, foto e nome no agendamento OK');

// 5. "qualquer um": lista quem está livre no horário e respeita o tempo de cada um
await l.goto(`${BASE}/lugar/${rid}/agendar?servico=${corte}`); await l.waitForSelector('text=Com quem?');
// O Lucas trabalha de terça a sexta: escolhe um desses dias (o primeiro depois de hoje pode ser sábado ou domingo, quando só a Ana está livre e a tela já a escolhe sozinha).
const links5 = l.locator('section[aria-labelledby=dia] ul.chip-row li a');
for (let i = 0, n = await links5.count(); i < n; i++) {
  if (/^(Ter|Qua|Qui|Sex)\b/.test(await links5.nth(i).innerText())) {
    const data = new URL(await links5.nth(i).getAttribute('href'), BASE).searchParams.get('data');
    await links5.nth(i).click(); await l.waitForURL((u) => u.searchParams.get('data') === data); break; // depois do expediente a tela já abre no dia seguinte: espera o dia escolhido de fato
  }
}
await l.waitForSelector('section[aria-labelledby=dia] a[aria-current=date]:not(:has-text("Hoje"))');
await l.click('ul.grid a:has-text("11:00")'); await l.waitForSelector('text=Livres neste horário');
const free = await l.locator('section[aria-labelledby=confirmar] ul a').allInnerTexts();
assert.ok(free.some((t) => /Ana/.test(t) && /60 min/.test(t)), `Ana livre com 60 min: ${free}`);
console.log('5. "qualquer um": mostra quem está livre e o tempo de cada profissional OK');

// 6. e-mail ao profissional e ao e-mail da conta (arquivo de desenvolvimento)
const mails = readFileSync(MAIL, 'utf8').trim().split('\n').map((x) => JSON.parse(x));
const sent = mails.filter((m) => /Novo agendamento: Corte/.test(m.subject));
assert.ok(sent.some((m) => m.to === 'lucas.barbeiro@teste.com') && sent.some((m) => m.to === 'ze@burger.com'), `destinatários: ${sent.map((m) => m.to)}`);
assert.match(sent[0].text, /Cliente: Lucas Silva/); assert.match(sent[0].text, /Profissional: Lucas Barbeiro/);
console.log('6. e-mail de novo agendamento vai para o profissional e para o e-mail da conta OK');

await b.close();
console.log('ALL OK (equipe)');
