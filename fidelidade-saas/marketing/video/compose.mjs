// Monta o vídeo final (1080x1920): abertura, gravação do app dentro de um celular com legendas, e fechamento.
// Uso: node marketing/video/compose.mjs cliente   (precisa de out/<nome>-raw.mp4 e out/<nome>-beats.json)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { stories, OUTRO } from './stories.mjs';

const name = process.argv[2];
const story = stories[name];
if (!story) throw new Error(`roteiro "${name}" não existe em stories.mjs`);
const OUT = path.resolve('marketing/video/out');
const W = 1080, H = 1920, SW = 702, SH = 1519, SX = (W - SW) / 2, SY = 372, FPS = 30;
const NAVY = '#0F1F3D', LIME = '#C6F432', BLUE = '#2150C9';
const beats = JSON.parse(fs.readFileSync(path.join(OUT, `${name}-beats.json`), 'utf8'));
const rawDur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(OUT, `${name}-raw.mp4`)]).toString();
const tOf = (n) => beats.find((b) => b.name === n)?.t ?? 0;

const logo = (fill, ink, s = 64) => `<svg viewBox="0 0 64 64" width="${s}" height="${s}"><rect width="64" height="64" rx="16" fill="${fill}"/><g transform="translate(-1 0)"><rect x="18" y="12" width="10" height="40" rx="5" fill="${ink}"/><rect x="18" y="12" width="30" height="10" rx="5" fill="${ink}"/><rect x="18" y="27" width="21" height="10" rx="5" fill="${ink}"/><circle cx="43.5" cy="47" r="5.4" fill="${ink}"/></g></svg>`;
const base = `*{box-sizing:border-box;margin:0}body{width:${W}px;height:${H}px;font-family:Inter,system-ui,sans-serif;overflow:hidden;position:relative}`;
const page = (css, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${base}${css}</style></head><body>${body}</body></html>`;

// fundo da cena do celular: marinho com formas e a moldura do aparelho (o vídeo entra por cima)
const bgHtml = page(`body{background:${NAVY}}
.b1{position:absolute;width:760px;height:760px;border-radius:50%;background:${BLUE};left:-300px;top:1250px;opacity:.55}
.b2{position:absolute;width:420px;height:420px;border-radius:50%;background:${LIME};right:-170px;top:250px;opacity:.9}
.bezel{position:absolute;left:${SX - 16}px;top:${SY - 16}px;width:${SW + 32}px;height:${SH + 32}px;border-radius:78px;background:#070F20;box-shadow:0 40px 90px rgba(0,0,0,.5)}`,
  `<div class="b1"></div><div class="b2"></div><div class="bezel"></div>`);
// máscara de cantos arredondados da tela
const maskHtml = page(`body{background:#000}.m{position:absolute;left:${SX}px;top:${SY}px;width:${SW}px;height:${SH}px;border-radius:64px;background:#fff}`, `<div class="m"></div>`);
const capHtml = (c) => page(`body{background:transparent}
.c{position:absolute;left:70px;right:70px;top:78px;color:#fff}
.t{font-size:72px;line-height:1.04;font-weight:800;letter-spacing:-2.5px}
.t em{font-style:normal;color:${LIME}}
.s{margin-top:18px;font-size:36px;font-weight:600;color:#B7C2DB;letter-spacing:-.5px}`,
  `<div class="c"><div class="t">${c.title}</div>${c.sub ? `<div class="s">${c.sub}</div>` : ''}</div>`);
const introHtml = (i) => page(`body{background:${NAVY};color:#fff}
.blob{position:absolute;width:900px;height:900px;border-radius:50%;background:${BLUE};opacity:.5;right:-420px;bottom:-250px}
.dot{position:absolute;width:300px;height:300px;border-radius:50%;background:${LIME};left:-110px;top:420px;opacity:.95}
.top{position:absolute;left:84px;top:92px;display:flex;align-items:center;gap:20px;font-weight:700;font-size:52px;letter-spacing:-1.5px}
.h{position:absolute;left:84px;right:84px;top:660px;font-size:128px;line-height:1;letter-spacing:-5px;font-weight:800}
.h em{font-style:normal;color:${LIME}}
.sub{position:absolute;left:88px;top:1250px;font-size:56px;font-weight:700;color:#B7C2DB;letter-spacing:-1.5px}`,
  `<div class="blob"></div><div class="dot"></div><div class="top">${logo(LIME, '#0B1B3A')}<span>fidelize</span></div><div class="h">${i.lines}</div>${i.sub ? `<div class="sub">${i.sub}</div>` : ''}`);
const outroHtml = (o) => page(`body{background:${LIME};color:${NAVY}}
.blob{position:absolute;width:820px;height:820px;border-radius:50%;background:${NAVY};left:-300px;bottom:-330px}
.top{position:absolute;left:84px;top:92px;display:flex;align-items:center;gap:20px;font-weight:700;font-size:52px;letter-spacing:-1.5px}
.h{position:absolute;left:84px;right:84px;top:600px;font-size:130px;line-height:1;letter-spacing:-5px;font-weight:800}
.h em{font-style:normal;color:${BLUE}}
.h{top:520px}
.price{position:absolute;left:84px;top:1000px;font-size:170px;line-height:1;font-weight:800;letter-spacing:-6px;color:${NAVY}}
.pnote{position:absolute;left:92px;top:1190px;font-size:50px;font-weight:700;color:${BLUE};letter-spacing:-1px}
.sub{position:absolute;left:88px;right:120px;top:1290px;font-size:44px;line-height:1.25;font-weight:600;color:#3C4A1A}
.cta{position:absolute;left:84px;top:1480px;display:flex;gap:22px;align-items:center}
.pill{background:${NAVY};color:#fff;font-size:54px;font-weight:800;padding:26px 56px;border-radius:999px;letter-spacing:-1px}
.hd{font-size:44px;font-weight:700;color:#fff;position:absolute;left:92px;top:1640px}`,
  `<div class="blob"></div><div class="top">${logo(NAVY, LIME)}<span>fidelize</span></div><div class="h">${o.lines}</div>${o.price ? `<div class="price">${o.price}</div><div class="pnote">${o.priceNote ?? ''}</div>` : ''}<div class="sub">${o.sub}</div><div class="cta"><div class="pill">${o.cta}</div></div><div class="hd">${o.handle}</div>`);

const shots = [
  ['bg', bgHtml], ['mask', maskHtml], ['intro', introHtml(story.intro)], ['outro', outroHtml({ ...OUTRO, ...(story.outro || {}) })],
  ...story.captions.map((c, i) => [`cap${i}`, capHtml(c)]),
];
const tmp = path.join(OUT, `${name}-tmp`); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: W, height: H } });
for (const [id, html] of shots) { await pg.setContent(html); await pg.waitForTimeout(150); await pg.screenshot({ path: path.join(tmp, `${id}.png`), omitBackground: id.startsWith('cap') }); }
await b.close();

// 1) cena do celular: fundo + gravação com cantos arredondados + legendas que entram e saem
const caps = story.captions.map((c, i) => { const s = tOf(c.at); const e = story.captions[i + 1] ? tOf(story.captions[i + 1].at) : rawDur; return { i, s, d: Math.max(0.8, e - s) }; });
const args = ['-v', 'error', '-y', '-loop', '1', '-t', String(rawDur), '-i', path.join(tmp, 'bg.png'), '-i', path.join(OUT, `${name}-raw.mp4`), '-loop', '1', '-t', String(rawDur), '-i', path.join(tmp, 'mask.png')];
caps.forEach((c) => args.push('-loop', '1', '-t', String(c.d), '-i', path.join(tmp, `cap${c.i}.png`)));
let fc = `[1:v]scale=${SW}:${SH}:flags=lanczos,format=rgba[scr];[2:v]format=gray,crop=${SW}:${SH}:${SX}:${SY}[mk];[scr][mk]alphamerge[rs];[0:v][rs]overlay=${SX}:${SY}:shortest=1[v0]`;
let last = 'v0';
caps.forEach((c, k) => {
  const fd = Math.min(0.3, c.d / 3);
  fc += `;[${3 + k}:v]format=rgba,fade=t=in:st=0:d=${fd}:alpha=1,fade=t=out:st=${(c.d - fd).toFixed(2)}:d=${fd}:alpha=1,setpts=PTS+${c.s}/TB[cp${k}];[${last}][cp${k}]overlay=0:0:eof_action=pass[v${k + 1}]`;
  last = `v${k + 1}`;
});
const screenFile = path.join(tmp, 'screen.mp4');
execFileSync('ffmpeg', [...args, '-filter_complex', fc, '-map', `[${last}]`, '-r', String(FPS), '-t', String(rawDur), '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', screenFile], { stdio: 'inherit' });

// 2) abertura e fechamento com um zoom leve
const still = (id, secs, out) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-i', path.join(tmp, `${id}.png`), '-vf', `scale=${W * 2}:${H * 2},zoompan=z='1+0.05*on/${Math.round(secs * FPS)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(secs * FPS)}:s=${W}x${H}:fps=${FPS},format=yuv420p`, '-t', String(secs), '-c:v', 'libx264', '-crf', '16', out]);
const introS = story.intro.seconds ?? 2.6, outroS = 3.2;
still('intro', introS, path.join(tmp, 'intro.mp4')); still('outro', outroS, path.join(tmp, 'outro.mp4'));

// 3) juntar com transições suaves e uma trilha muda (alguns envios de vídeo exigem áudio)
const X = 0.45;
const final = path.join(OUT, `fidelize-video-${name}.mp4`);
const total = introS + rawDur + outroS - 2 * X;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(tmp, 'intro.mp4'), '-i', screenFile, '-i', path.join(tmp, 'outro.mp4'), '-f', 'lavfi', '-t', total.toFixed(2), '-i', 'anullsrc=r=44100:cl=stereo',
  '-filter_complex', `[0:v][1:v]xfade=transition=fade:duration=${X}:offset=${(introS - X).toFixed(2)}[a];[a][2:v]xfade=transition=fade:duration=${X}:offset=${(introS + rawDur - 2 * X).toFixed(2)}[v]`,
  '-map', '[v]', '-map', '3:a', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', '-shortest', final], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log('pronto:', final, total.toFixed(1) + ' s');
