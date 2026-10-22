// Vídeo 2 (dono): lançar pontos pelo CPF no Caixa e a cliente vê o saldo subir. Gera out/caixa-raw.mp4 e out/caixa-beats.json.
import fs from 'node:fs';
import { BASE, resetDemo, launchPhone, phoneContext, record, tap, type, wait, beats, scroll } from './lib.mjs';
const OUT = 'marketing/video/out';
fs.mkdirSync(OUT, { recursive: true });
resetDemo();
const b = await launchPhone();
const dur = (stop) => stop.now();

// parte 1: o dono no Caixa
const octx = await phoneContext(b); const o = await octx.newPage();
await o.goto(BASE + '/login'); await o.fill('#email', 'cafe@demo.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard'); await o.waitForLoadState('networkidle');
await o.goto(BASE + '/dashboard/caixa'); await o.waitForLoadState('networkidle'); await wait(o, 700);
const s1 = await record(o, `${OUT}/caixa-p1.mp4`); const b1 = beats(s1); b1.mark('caixa');
await wait(o, 1700);
await tap(o, '#amount', { pause: 300 }); await type(o, '58,00', 90); b1.mark('valor');
await wait(o, 900);
await tap(o, '#cpf', { pause: 300 }); await type(o, '52998224725', 80); b1.mark('cpf');
await wait(o, 900);
await tap(o, 'label:has-text("Foto no Instagram")', { pause: 400 }); b1.mark('interacao');
await wait(o, 1300);
const submit = o.locator('button[type=submit]:visible').filter({ hasNotText: /Buscar|Aplicar|Sair/ }).first();
await tap(o, submit, { pause: 500 });
await o.waitForSelector('text=pontos lançados para Marina');
const card = o.locator('text=pontos lançados para Marina').first();
const y = (await card.boundingBox()).y; b1.mark('lancado');
await scroll(o, Math.max(0, y - 420), 900);
await wait(o, 2800);
const d1 = dur(s1); await s1(); await octx.close();

// parte 2: a cliente vê o saldo
const cctx = await phoneContext(b); const c = await cctx.newPage();
await c.goto(BASE + '/entrar'); await c.fill('input[name=email]', 'marina@demo.com'); await c.fill('input[name=password]', 'senha-cliente-1');
await c.click('button:has-text("Entrar") >> nth=-1'); await c.waitForURL('**/carteira'); await c.waitForLoadState('networkidle'); await c.waitForSelector('text=Saldo total'); await c.waitForSelector('text=Suas carteiras'); await wait(c, 800);
const s2 = await record(c, `${OUT}/caixa-p2.mp4`); const b2 = beats(s2); b2.mark('saldo-novo');
await wait(c, 2600);
await tap(c, 'a:has-text("Café da Esquina")', { pause: 900 }); await c.waitForLoadState('networkidle'); b2.mark('premios');
await scroll(c, 520, 1000); await wait(c, 2200);
const d2 = dur(s2); await s2(); await cctx.close();

// parte 3: cliente que ainda não tem conta recebe um QR Code
const qctx = await phoneContext(b); const q = await qctx.newPage();
await q.goto(BASE + '/login'); await q.fill('#email', 'cafe@demo.com'); await q.fill('#password', 'senha-segura-1'); await q.click('button[type=submit]'); await q.waitForURL('**/dashboard'); await q.waitForLoadState('networkidle');
await q.goto(BASE + '/dashboard/caixa'); await q.waitForLoadState('networkidle'); await wait(q, 700);
const s3 = await record(q, `${OUT}/caixa-p3.mp4`); const b3 = beats(s3); b3.mark('qr-valor');
await wait(q, 1500);
await tap(q, '#amount', { pause: 300 }); await type(q, '32,00', 90);
await wait(q, 1200);
await tap(q, 'button:has-text("Gerar QR Code")', { pause: 400 });
await q.waitForSelector('text=Enviar por WhatsApp'); b3.mark('qr');
const qrCard = q.locator('text=QR Code de uso único').first();
const qy = (await qrCard.boundingBox()).y;
await scroll(q, Math.max(0, qy - 700), 900);
await wait(q, 3200);
const d3 = s3.now(); await s3(); await b.close();

const { joinParts } = await import('./lib.mjs');
const all = joinParts([{ file: `${OUT}/caixa-p1.mp4`, beats: b1.list, dur: d1 }, { file: `${OUT}/caixa-p2.mp4`, beats: b2.list, dur: d2 }, { file: `${OUT}/caixa-p3.mp4`, beats: b3.list, dur: d3 }], `${OUT}/caixa-raw.mp4`);
fs.writeFileSync(`${OUT}/caixa-beats.json`, JSON.stringify(all, null, 1));
console.log(JSON.stringify(all));
