// Utilidades dos vídeos: app local, banco de demonstração e navegador.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';

export const BASE = process.env.BASE || 'http://localhost:3000';
export const DB = process.env.DB || 'postgresql://postgres:postgres@localhost:5432/fidelidade';
export const sql = (q) => execSync(`psql ${DB} -At -c ${JSON.stringify(q)}`).toString().trim();
export const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
// Celular para gravar: janela de 390x844 com escala 2x (os quadros saem em 780x1688, nítidos).
export const launchPhone = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--force-device-scale-factor=2', '--window-size=390,844', '--hide-scrollbars'] });
export const phoneContext = async (b, opts = {}) => { const ctx = await b.newContext({ viewport: null, ...opts }); await prepare(ctx); await touchDot(ctx); return ctx; };
export const wait = (page, ms) => page.waitForTimeout(ms);

// Marca "Li e concordo" nos cadastros e esconde avisos que não servem no vídeo.
export const prepare = (ctx) => ctx.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal,#__next-build-watcher{display:none!important}'; document.head.appendChild(s); });
  try { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); sessionStorage.setItem('fz_splash', '1'); } catch {}
  const f = () => document.querySelectorAll('input[name=acceptTerms]').forEach((e) => { if (!e.checked) e.click(); });
  new MutationObserver(f).observe(document, { subtree: true, childList: true });
});

// ---------- gravação em alta resolução (quadros do navegador a 2x) ----------
import fs from 'node:fs';
import path from 'node:path';

// Ponto de toque que acompanha o mouse, para o vídeo mostrar onde a pessoa tocou.
export const touchDot = (ctx) => ctx.addInitScript(() => {
  const add = () => {
    if (document.getElementById('fz-dot')) return;
    const s = document.createElement('style');
    s.textContent = '#fz-dot{position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(198,244,50,.55);border:3px solid rgba(15,31,61,.55);pointer-events:none;z-index:2147483647;transform:translate(-100px,-100px) scale(1);transition:transform .08s linear,opacity .2s;opacity:0}#fz-dot.on{opacity:1}#fz-dot.down{background:rgba(198,244,50,.9)}';
    document.head.appendChild(s);
    const d = document.createElement('div'); d.id = 'fz-dot'; document.body.appendChild(d);
    const at = (e) => { d.classList.add('on'); d.style.transform = `translate(${e.clientX}px,${e.clientY}px) scale(${d.classList.contains('down') ? 0.8 : 1})`; };
    addEventListener('mousemove', at, true);
    addEventListener('mousedown', (e) => { d.classList.add('down'); at(e); }, true);
    addEventListener('mouseup', (e) => { d.classList.remove('down'); at(e); }, true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
});

// Grava a aba em quadros (CDP screencast). stop() devolve o vídeo .mp4 sem som.
export async function record(page, outFile, { fps = 30 } = {}) {
  const dir = path.resolve(outFile.replace(/\.mp4$/, '') + '-frames');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const i = frames.length;
    frames.push(f.metadata.timestamp);
    fs.writeFileSync(path.join(dir, `${String(i).padStart(6, '0')}.jpg`), Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const vp = page.viewportSize() ?? await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: vp.width * 2, maxHeight: vp.height * 2, everyNthFrame: 1 });
  const start = Date.now() / 1000;
  const stop = async () => {
    const end = Date.now() / 1000;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    // lista com a duração de cada quadro (concat demuxer), repetindo o último um instante
    let list = '';
    // o vídeo começa no instante em que a gravação começou (o 1º quadro vale desde lá) e termina quando ela parou
    frames.forEach((t, i) => { const from = i === 0 ? Math.min(t, start) : t; const next = frames[i + 1] ?? Math.max(end, t + 0.3); list += `file '${path.join(dir, String(i).padStart(6, '0') + '.jpg')}'\nduration ${Math.max(0.001, next - from).toFixed(4)}\n`; });
    list += `file '${path.join(dir, String(frames.length - 1).padStart(6, '0') + '.jpg')}'\n`;
    fs.writeFileSync(path.join(dir, 'list.txt'), list);
    const { execFileSync } = await import('node:child_process');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', `fps=${fps},format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', outFile]);
    fs.rmSync(dir, { recursive: true, force: true });
    return outFile;
  };
  stop.now = () => +(Date.now() / 1000 - start).toFixed(2);
  return stop;
}

// Move o ponto até o elemento em passos suaves e toca.
export async function tap(page, target, { pause = 450, steps = 14 } = {}) {
  const loc = typeof target === 'string' ? page.locator(target).first() : target;
  await loc.scrollIntoViewIfNeeded();
  const bb = await loc.boundingBox();
  const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
  await page.mouse.move(x, y, { steps });
  await page.waitForTimeout(120);
  await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
  await page.waitForTimeout(pause);
}

// Rolagem suave com a roda do mouse.
export async function scroll(page, dy, ms = 900) {
  const n = Math.max(1, Math.round(ms / 30));
  for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy / n); await page.waitForTimeout(30); }
  await page.waitForTimeout(250);
}

// Digita devagar, como uma pessoa.
export const type = (page, text, delay = 55) => page.keyboard.type(text, { delay });

// Marcadores de tempo (segundos desde o início da gravação) para a montagem posicionar os textos.
export function beats(rec) {
  const list = [];
  return { mark: (name) => { list.push({ name, t: rec.now() }); return list.at(-1).t; }, list };
}

// Volta os dados da demonstração ao ponto de partida (Marina com 1.240 pontos, sem resgates nem lançamentos novos).
export function resetDemo() {
  const first = `(select min("createdAt") from "Transaction" where type='EARN') + interval '5 seconds'`;
  sql(`delete from "RateLimit"; delete from "CheckIn"; delete from "Order"; delete from "BirthdayGift"; update "Customer" set "birthDay"=null, "birthMonth"=null; delete from "Booking"; delete from "SlotHold"; delete from "Redemption"; delete from "Transaction" where "createdAt" > ${first}; delete from "Notification" where "createdAt" > ${first}; delete from "Claim" where "createdAt" > ${first}; update "Wallet" set balance=1240`);
}

// Junta as partes gravadas (mesmo formato) num vídeo só e devolve os marcadores com o tempo somado.
export function joinParts(parts, outFile) {
  // parts: [{ file, beats: [{name,t}], dur }]
  const list = parts.map((p) => `file '${path.resolve(p.file)}'`).join('\n');
  const lf = outFile.replace(/\.mp4$/, '-parts.txt');
  fs.writeFileSync(lf, list);
  execSync(`ffmpeg -v error -y -f concat -safe 0 -i ${lf} -c copy ${outFile}`);
  fs.rmSync(lf);
  let off = 0; const all = [];
  for (const p of parts) { p.beats.forEach((b) => all.push({ name: b.name, t: +(b.t + off).toFixed(2) })); off += p.dur; }
  for (const p of parts) fs.rmSync(p.file, { force: true });
  return all;
}

// Limpa os agendamentos da barbearia para repetir a gravação.
export function resetAgenda() {
  sql(`delete from "RateLimit"; delete from "SlotHold"; delete from "WaitlistEntry"; delete from "Booking" where "restaurantId"=(select id from "Restaurant" where email='leo@demo.com')`);
}
