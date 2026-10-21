// Vídeo 1 (cliente): os pontos ficam no celular, mostram quanto falta e viram prêmio. Gera out/cliente-raw.mp4 e out/cliente-beats.json.
import fs from 'node:fs';
import { BASE, resetDemo, launchPhone, phoneContext, record, tap, scroll, wait, beats } from './lib.mjs';
fs.mkdirSync('marketing/video/out', { recursive: true });
resetDemo();

const b = await launchPhone(); const ctx = await phoneContext(b); const p = await ctx.newPage();
await p.goto(BASE + '/entrar'); await p.fill('input[name=email]', 'marina@demo.com'); await p.fill('input[name=password]', 'senha-cliente-1');
await p.click('button:has-text("Entrar") >> nth=-1'); await p.waitForURL('**/carteira'); await p.waitForLoadState('networkidle'); await wait(p, 900);

const stop = await record(p, 'marketing/video/out/cliente-raw.mp4'); const bt = beats(stop); bt.mark('inicio');
await wait(p, 2200);
bt.mark('carteira-aberta');
await tap(p, 'a:has-text("Café da Esquina")', { pause: 1300 }); await p.waitForLoadState('networkidle');
bt.mark('saldo');
await wait(p, 1500);
await scroll(p, 520, 1100); bt.mark('premios');
await wait(p, 900);
await tap(p, 'button[aria-label="Resgatar Pão de queijo + café"]', { pause: 1000 });
bt.mark('confirmar');
await wait(p, 600);
await tap(p, 'text=Confirmar', { pause: 600 });
await p.waitForSelector('text=Resgate feito!'); bt.mark('cupom');
await wait(p, 2800);
bt.mark('fim');
await stop(); await b.close();
fs.writeFileSync('marketing/video/out/cliente-beats.json', JSON.stringify(bt.list, null, 1));
console.log(JSON.stringify(bt.list));
