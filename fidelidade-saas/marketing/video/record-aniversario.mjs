// Vídeo 5 (aniversário): a cliente informa o dia e o mês e, no dia, ganha o presente de pontos do lugar.
// Gera out/aniversario-raw.mp4 e out/aniversario-beats.json. A "virada do dia" é o próprio cron do app, rodado entre as duas partes.
import fs from 'node:fs';
import { BASE, sql, resetDemo, launchPhone, phoneContext, record, tap, scroll, wait, beats, joinParts } from './lib.mjs';
const OUT = 'marketing/video/out';
fs.mkdirSync(OUT, { recursive: true });
resetDemo();
const rid = sql(`select id from "Restaurant" where email='cafe@demo.com'`);
const today = sql(`select extract(day from now() at time zone 'America/Sao_Paulo')::int||'/'||extract(month from now() at time zone 'America/Sao_Paulo')::int`).split('/');

const b = await launchPhone(); const ctx = await phoneContext(b); const p = await ctx.newPage();
await p.goto(BASE + '/entrar'); await p.fill('input[name=email]', 'marina@demo.com'); await p.fill('input[name=password]', 'senha-cliente-1');
await p.click('button:has-text("Entrar") >> nth=-1'); await p.waitForURL('**/carteira'); await p.waitForLoadState('networkidle');
await p.goto(`${BASE}/lugar/${rid}`); await p.waitForLoadState('networkidle'); await wait(p, 800);

// parte 1: informar o aniversário
const s1 = await record(p, `${OUT}/aniversario-p1.mp4`); const b1 = beats(s1); b1.mark('lugar');
await wait(p, 2600);
await tap(p, '[data-testid=birthday-open]', { pause: 700 }); b1.mark('informar');
await wait(p, 900);
await p.selectOption('#b-day', today[0]); await wait(p, 700);
await p.selectOption('#b-month', today[1]); await wait(p, 900); b1.mark('data');
await tap(p, 'form:has(#b-day) button[type=submit]', { pause: 500 });
for (let i = 0; i < 40 && sql(`select "birthDay" is not null from "Customer" where email='marina@demo.com'`) !== 't'; i++) await wait(p, 250);
b1.mark('salvo');
await wait(p, 2600);
const d1 = s1.now(); await s1();

// a virada do dia: o app roda a rotina diária e credita o presente
const r = await fetch(BASE + '/api/cron/lembretes', { method: 'POST', headers: { authorization: 'Bearer ' + (process.env.CRON_SECRET || 'segredo-de-teste-1234567890') } }).then((x) => x.json());
if (!(r.birthdayGifts >= 1)) throw new Error('o presente não foi creditado: ' + JSON.stringify(r));

// parte 2: o aviso e o saldo
await p.goto(BASE + '/avisos'); await p.waitForLoadState('networkidle'); await wait(p, 600);
const s2 = await record(p, `${OUT}/aniversario-p2.mp4`); const b2 = beats(s2); b2.mark('aviso');
await wait(p, 3000);
await p.goto(`${BASE}/lugar/${rid}`); await p.waitForLoadState('networkidle'); b2.mark('saldo');
await wait(p, 3200);
const d2 = s2.now(); await s2(); await b.close();

const all = joinParts([{ file: `${OUT}/aniversario-p1.mp4`, beats: b1.list, dur: d1 }, { file: `${OUT}/aniversario-p2.mp4`, beats: b2.list, dur: d2 }], `${OUT}/aniversario-raw.mp4`);
fs.writeFileSync(`${OUT}/aniversario-beats.json`, JSON.stringify(all, null, 1));
console.log(JSON.stringify(all));
