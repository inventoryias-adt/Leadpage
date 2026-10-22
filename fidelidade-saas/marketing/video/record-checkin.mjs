// Vídeo 4 (check-in): a cliente chega no lugar, faz check-in e ganha pontos. Gera out/checkin-raw.mp4 e out/checkin-beats.json.
import fs from 'node:fs';
import { BASE, resetDemo, launchPhone, phoneContext, record, tap, scroll, wait, beats } from './lib.mjs';
fs.mkdirSync('marketing/video/out', { recursive: true });
resetDemo();

const b = await launchPhone();
// o celular "está" na porta do café (a leitura do GPS vem de dentro do navegador)
const ctx = await phoneContext(b, { geolocation: { latitude: -23.55053, longitude: -46.63332, accuracy: 5 }, permissions: ['geolocation'] }); const p = await ctx.newPage();
await p.goto(BASE + '/entrar'); await p.fill('input[name=email]', 'marina@demo.com'); await p.fill('input[name=password]', 'senha-cliente-1');
await p.click('button:has-text("Entrar") >> nth=-1'); await p.waitForURL('**/carteira'); await p.waitForLoadState('networkidle'); await wait(p, 900);

const stop = await record(p, 'marketing/video/out/checkin-raw.mp4'); const bt = beats(stop); bt.mark('inicio');
await wait(p, 1800);
await tap(p, 'a[href="/lugares"]:visible', { pause: 500 }); await p.waitForURL('**/lugares'); await p.waitForLoadState('networkidle'); bt.mark('lugares');
await wait(p, 1800);
await tap(p, 'a[href^="/lugar/"]:has-text("Café da Esquina")', { pause: 600 }); await p.waitForURL('**/lugar/*'); await p.waitForLoadState('networkidle'); bt.mark('lugar');
await wait(p, 1400);
await scroll(p, 330, 800);
await tap(p, 'button:has-text("Ações para ganhar pontos")', { pause: 700 }); bt.mark('acoes');
await wait(p, 900);
await scroll(p, 260, 700);
await wait(p, 700);
await tap(p, 'button:has-text("Fazer check-in")', { pause: 300 }); bt.mark('checkin');
await p.waitForSelector('text=Check-in feito!'); bt.mark('feito');
await wait(p, 2200);
await scroll(p, -900, 900); bt.mark('saldo');
await wait(p, 2600);
bt.mark('fim');
await stop(); await b.close();
fs.writeFileSync('marketing/video/out/checkin-beats.json', JSON.stringify(bt.list, null, 1));
console.log(JSON.stringify(bt.list));
