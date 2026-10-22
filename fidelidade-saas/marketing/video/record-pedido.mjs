// Vídeo 6 (pedido com retirada): a cliente pede pelo app, o dono prepara e avisa que está pronto. Gera out/pedido-raw.mp4 e out/pedido-beats.json.
import fs from 'node:fs';
import { BASE, sql, resetDemo, launchPhone, phoneContext, record, tap, scroll, wait, beats, joinParts } from './lib.mjs';
const OUT = 'marketing/video/out';
fs.mkdirSync(OUT, { recursive: true });
resetDemo();
const rid = sql(`select id from "Restaurant" where email='cafe@demo.com'`);

const b = await launchPhone();
const cctx = await phoneContext(b); const c = await cctx.newPage();
await c.goto(BASE + '/entrar'); await c.fill('input[name=email]', 'marina@demo.com'); await c.fill('input[name=password]', 'senha-cliente-1');
await c.click('button:has-text("Entrar") >> nth=-1'); await c.waitForURL('**/carteira'); await c.waitForLoadState('networkidle');
await c.goto(`${BASE}/lugar/${rid}`); await c.waitForLoadState('networkidle'); await wait(c, 800);

// parte 1: o pedido
const s1 = await record(c, `${OUT}/pedido-p1.mp4`); const b1 = beats(s1); b1.mark('lugar');
await wait(c, 1800);
await tap(c, '[data-testid=make-order]', { pause: 500 }); await c.waitForURL('**/pedido**'); await c.waitForLoadState('networkidle'); b1.mark('cardapio');
await wait(c, 2200);
await tap(c, 'button[aria-label="Adicionar Combo café da manhã à sacola"]', { pause: 600 }); b1.mark('sacola');
await scroll(c, 520, 800);
await tap(c, 'button[aria-label="Adicionar Capuccino à sacola"]', { pause: 700 });
await wait(c, 800);
await tap(c, '[data-testid=open-bag]', { pause: 900 }); await c.waitForSelector('[data-testid=bag-line]'); b1.mark('conferir');
await wait(c, 1800);
await tap(c, '[data-testid=bag-continue]', { pause: 700 }); await c.waitForSelector('text=Como você quer receber'); b1.mark('retirada');
await wait(c, 1800);
await tap(c, '[data-testid=order-confirm]', { pause: 500 }); await c.waitForSelector('[data-testid=order-done]'); b1.mark('codigo');
await wait(c, 3000);
const d1 = s1.now(); await s1();

// parte 2: o dono recebe, prepara e avisa
const octx = await phoneContext(b); const o = await octx.newPage();
await o.goto(BASE + '/login'); await o.fill('#email', 'cafe@demo.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard'); await o.waitForLoadState('networkidle');
await o.goto(BASE + '/dashboard/pedidos'); await o.waitForSelector('[data-testid=order-card]'); await wait(o, 600);
const s2 = await record(o, `${OUT}/pedido-p2.mp4`); const b2 = beats(s2); b2.mark('dono');
await wait(o, 2800);
await tap(o, 'button:has-text("Começar a preparar")', { pause: 1400 }); b2.mark('preparando');
await o.waitForSelector('button:has-text("Pronto para retirar")');
await wait(o, 1200);
await tap(o, 'button:has-text("Pronto para retirar")', { pause: 1800 }); b2.mark('pronto');
await wait(o, 1600);
const d2 = s2.now(); await s2();

// parte 3: a cliente é avisada
await c.goto(BASE + '/avisos'); await c.waitForLoadState('networkidle'); await wait(c, 600);
const s3 = await record(c, `${OUT}/pedido-p3.mp4`); const b3 = beats(s3); b3.mark('avisada');
await wait(c, 3400);
const d3 = s3.now(); await s3(); await b.close();

const all = joinParts([{ file: `${OUT}/pedido-p1.mp4`, beats: b1.list, dur: d1 }, { file: `${OUT}/pedido-p2.mp4`, beats: b2.list, dur: d2 }, { file: `${OUT}/pedido-p3.mp4`, beats: b3.list, dur: d3 }], `${OUT}/pedido-raw.mp4`);
fs.writeFileSync(`${OUT}/pedido-beats.json`, JSON.stringify(all, null, 1));
console.log(JSON.stringify(all));
