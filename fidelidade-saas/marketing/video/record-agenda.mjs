// Vídeo 3 (agenda): a cliente agenda um horário e o dono vê e confirma. Gera out/agenda-raw.mp4 e out/agenda-beats.json.
import fs from 'node:fs';
import { BASE, sql, resetAgenda, launchPhone, phoneContext, record, tap, scroll, wait, beats, joinParts } from './lib.mjs';
const OUT = 'marketing/video/out';
fs.mkdirSync(OUT, { recursive: true });
resetAgenda();
const rid = sql(`select id from "Restaurant" where email='leo@demo.com'`);
const tomorrow = new Date(Date.now() - 3 * 3600e3 + 86400e3).toISOString().slice(0, 10);
const b = await launchPhone();

// parte 1: a cliente agenda
const cctx = await phoneContext(b); const c = await cctx.newPage();
await c.goto(BASE + '/entrar'); await c.fill('input[name=email]', 'marina@demo.com'); await c.fill('input[name=password]', 'senha-cliente-1');
await c.click('button:has-text("Entrar") >> nth=-1'); await c.waitForURL('**/carteira'); await c.waitForLoadState('networkidle');
await c.goto(`${BASE}/lugar/${rid}/agendar`); await c.waitForLoadState('networkidle'); await wait(c, 600);
const s1 = await record(c, `${OUT}/agenda-p1.mp4`); const b1 = beats(s1); b1.mark('servicos');
await wait(c, 2000);
await tap(c, 'a:has-text("Corte")', { pause: 300 }); await c.waitForURL('**servico=**'); await c.waitForLoadState('networkidle'); b1.mark('profissional');
await wait(c, 1100);
await tap(c, 'a:has-text("Amanhã")', { pause: 200 }); await c.waitForURL('**data=**'); await c.waitForLoadState('networkidle');
await wait(c, 500);
await tap(c, 'a[href*="prof="]:has-text("Léo")', { pause: 300 }); await c.waitForURL('**prof=**'); await c.waitForLoadState('networkidle'); b1.mark('horario');
await wait(c, 1800);
await scroll(c, 260, 700);
await tap(c, 'a:has-text("14:30")', { pause: 300 }); await c.waitForURL('**hora=**'); await c.waitForLoadState('networkidle'); b1.mark('confirmar');
await wait(c, 800);
await scroll(c, 1100, 1100);
await wait(c, 900);
await tap(c, 'button:has-text("Confirmar agendamento")', { pause: 400 });
await c.waitForURL('**/perfil/agendamentos**'); await c.waitForLoadState('networkidle'); b1.mark('sucesso');
await wait(c, 3000);
const d1 = s1.now(); await s1(); await cctx.close();

// parte 2: o dono vê a agenda
const octx = await phoneContext(b); const o = await octx.newPage();
await o.goto(BASE + '/login'); await o.fill('#email', 'leo@demo.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard'); await o.waitForLoadState('networkidle');
await o.goto(`${BASE}/dashboard/agenda?data=${tomorrow}&per=dia&vista=lista`); await o.waitForLoadState('networkidle'); await wait(o, 600);
const s2 = await record(o, `${OUT}/agenda-p2.mp4`); const b2 = beats(s2); b2.mark('dono');
await wait(o, 3200);
const d2 = s2.now(); await s2(); await b.close();

const all = joinParts([{ file: `${OUT}/agenda-p1.mp4`, beats: b1.list, dur: d1 }, { file: `${OUT}/agenda-p2.mp4`, beats: b2.list, dur: d2 }], `${OUT}/agenda-raw.mp4`);
fs.writeFileSync(`${OUT}/agenda-beats.json`, JSON.stringify(all, null, 1));
console.log(JSON.stringify(all));
