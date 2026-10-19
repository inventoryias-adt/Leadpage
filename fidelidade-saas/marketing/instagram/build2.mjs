// Série 2 — "Chega de cartãozinho": tom lúdico, ilustrações em SVG/HTML. Uso: node marketing/instagram/build2.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'png-serie2');
fs.mkdirSync(OUT, { recursive: true });
const NAVY = '#0F1F3D', LIME = '#C6F432', BLUE = '#2150C9', LIGHT = '#F7F8FA', PINK = '#FF7AA8', SUN = '#FFC93C', RED = '#E5484D';

const logo = (fill, ink) => `<svg viewBox="0 0 64 64" width="56" height="56"><rect width="64" height="64" rx="16" fill="${fill}"/><g transform="translate(-1 0)"><rect x="18" y="12" width="10" height="40" rx="5" fill="${ink}"/><rect x="18" y="12" width="30" height="10" rx="5" fill="${ink}"/><rect x="18" y="27" width="21" height="10" rx="5" fill="${ink}"/><circle cx="43.5" cy="47" r="5.4" fill="${ink}"/></g></svg>`;
const THEMES = {
  navy:  { bg: NAVY,  fg: '#fff', mut: '#B7C2DB', logoFill: LIME, logoInk: '#0B1B3A' },
  lime:  { bg: LIME,  fg: NAVY,   mut: '#3C4A1A', logoFill: NAVY, logoInk: LIME },
  blue:  { bg: BLUE,  fg: '#fff', mut: '#D3DEFA', logoFill: LIME, logoInk: '#0B1B3A' },
  light: { bg: LIGHT, fg: NAVY,   mut: '#5B6783', logoFill: LIME, logoInk: '#0B1B3A' },
  pink:  { bg: PINK,  fg: NAVY,   mut: '#5A1B33', logoFill: NAVY, logoInk: LIME },
  sun:   { bg: SUN,   fg: NAVY,   mut: '#5A4300', logoFill: NAVY, logoInk: LIME },
};

const css = `
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;font-family:Inter,'Inter Variable',system-ui,sans-serif;overflow:hidden}
.s{width:1080px;height:1350px;padding:84px 84px 72px;display:flex;flex-direction:column;position:relative;overflow:hidden}
.top{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:3}
.brand{display:flex;align-items:center;gap:16px;font-weight:700;font-size:40px;letter-spacing:-1px}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px;position:relative;z-index:2}
.foot{display:flex;align-items:center;justify-content:space-between;font-size:26px;font-weight:550;position:relative;z-index:3}
h1{font-size:104px;line-height:1;letter-spacing:-4px;font-weight:700}
h1.m{font-size:86px;letter-spacing:-3px}
h1.sm{font-size:72px;letter-spacing:-2.5px}
p.lead{font-size:38px;line-height:1.35;font-weight:500}
.sticker{position:absolute;z-index:4;font-weight:800;border-radius:999px;padding:16px 34px;font-size:36px;letter-spacing:-.5px;box-shadow:0 8px 0 rgba(0,0,0,.18)}
.dots{display:flex;gap:10px}.dots i{width:14px;height:14px;border-radius:50%;opacity:.3;background:currentColor}.dots i.on{opacity:1;width:38px;border-radius:8px}
.phone{width:440px;border-radius:64px;border:16px solid #0B1B3A;background:#F7F8FA;padding:44px 26px 30px;box-shadow:0 30px 60px rgba(0,0,0,.35);position:relative;color:${NAVY}}
.phone:before{content:'';position:absolute;top:12px;left:50%;width:110px;height:26px;margin-left:-55px;border-radius:14px;background:#0B1B3A}
.pcard{border-radius:28px;padding:24px 26px;background:${NAVY};color:#fff}
.bar{height:20px;border-radius:12px;background:rgba(255,255,255,.2);overflow:hidden}.bar i{display:block;height:100%;background:${LIME}}
.row{display:flex;gap:22px}
.deco{position:absolute;border-radius:50%;z-index:1}
.x{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:360px;font-weight:900;color:${RED};line-height:1;opacity:.92;text-shadow:0 8px 0 rgba(0,0,0,.15)}
ul.l{list-style:none;padding:0;display:flex;flex-direction:column;gap:20px}
ul.l li{display:flex;gap:20px;align-items:center;font-size:36px;line-height:1.2;font-weight:600}
ul.l li b{flex:none;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px}
`;

// cartão de carimbos (papel) em SVG
const stampCard = ({ color = SUN, stamped = 9, w = 560, rot = 0, torn = false }) => {
  const h = w * 0.62;
  const circles = Array.from({ length: 10 }, (_, i) => {
    const cx = 70 + (i % 5) * 100, cy = 140 + Math.floor(i / 5) * 90, on = i < stamped;
    return `<circle cx="${cx}" cy="${cy}" r="34" fill="${on ? NAVY : 'none'}" stroke="${NAVY}" stroke-width="5" stroke-dasharray="${on ? '0' : '10 8'}"/>${on ? `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="40" fill="${color}" font-weight="900">★</text>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 580 360" width="${w}" height="${h}" style="transform:rotate(${rot}deg);filter:drop-shadow(0 14px 0 rgba(0,0,0,.18))"><rect x="6" y="6" width="568" height="348" rx="26" fill="${color}" stroke="${NAVY}" stroke-width="6"/><text x="38" y="70" font-size="34" font-weight="900" fill="${NAVY}" letter-spacing="2" font-family="Inter,sans-serif">CARTÃO FIDELIDADE</text><text x="38" y="102" font-size="22" font-weight="600" fill="${NAVY}" font-family="Inter,sans-serif">10 carimbos = 1 brinde*</text>${circles}<text x="38" y="338" font-size="18" font-weight="600" fill="${NAVY}" font-family="Inter,sans-serif">*se você não perder este cartão</text>${torn ? `<path d="M6 190 L120 170 L200 200 L300 165 L400 200 L480 172 L574 195" stroke="${NAVY}" stroke-width="4" fill="none" stroke-dasharray="3 10"/>` : ''}</svg>`;
};

const phone = (inner) => `<div class="phone">${inner}</div>`;
const walletScreen = (pts = '1.240', pct = 83, falta = 'Faltam 260 pts para o café grátis ☕') => `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px"><div style="width:44px;height:44px;border-radius:14px;background:${LIME};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:26px">F</div><div style="font-weight:700;font-size:26px">Café da Esquina</div></div>
  <div class="pcard"><div style="font-size:22px;opacity:.7;font-weight:600">Seus pontos</div><div style="font-size:84px;font-weight:800;letter-spacing:-3px;line-height:1.05">${pts}</div><div class="bar" style="margin:14px 0"><i style="width:${pct}%"></i></div><div style="font-size:22px;font-weight:600;color:${LIME}">${falta}</div></div>
  <div style="display:flex;gap:12px;margin-top:16px"><div style="flex:1;background:#fff;border-radius:20px;padding:16px;font-weight:700;font-size:22px;border:2px solid #E5E7EB">🎁 Prêmios</div><div style="flex:1;background:#fff;border-radius:20px;padding:16px;font-weight:700;font-size:22px;border:2px solid #E5E7EB">🕘 Histórico</div></div>`;

const shell = (t, body, { idx = 0, total = 1, deco = '', extra = '' } = {}) => {
  const T = THEMES[t];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="s" style="background:${T.bg};color:${T.fg}">
    ${deco}${extra}
    <div class="top"><div class="brand">${logo(T.logoFill, T.logoInk)}<span>fidelize</span></div></div>
    <div class="body">${typeof body === 'function' ? body(T) : body}</div>
    <div class="foot"><span style="color:${T.mut}">@usefidelize</span>${total > 1 ? `<div class="dots">${Array.from({ length: total }, (_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>` : '<span></span>'}</div>
  </div></body></html>`;
};
const blob = (c, size, x, y) => `<div class="deco" style="width:${size}px;height:${size}px;background:${c};left:${x}px;top:${y}px"></div>`;
const sticker = (txt, bg, fg, x, y, rot) => `<div class="sticker" style="background:${bg};color:${fg};left:${x}px;top:${y}px;transform:rotate(${rot}deg)">${txt}</div>`;

const pieces = [];
const add = (file, html) => pieces.push({ file, html });

// 01 — capa: Chega de cartãozinho
add('01-chega-de-cartaozinho', shell('lime', (T) => `
  <div style="position:relative;align-self:center;margin-top:10px">${stampCard({ color: SUN, stamped: 9, w: 700, rot: -7 })}<div class="x" style="font-size:520px">✕</div></div>
  <h1>Chega de<br>cartãozinho.</h1>
  <p class="lead" style="color:${T.mut}">Chega de carimbo, de cartão amassado e de "esqueci em casa".</p>`,
  { deco: blob('rgba(15,31,61,.08)', 640, 560, -200), extra: sticker('9/10 carimbos 😬', NAVY, LIME, 590, 150, 8) }));

// 02 — pergunta: carteira estourando de cartões
const pile = [[PINK, -12, 0], [SUN, 8, 70], [BLUE, -5, 140], [LIME, 10, 210]].map(([c, r, y], i) => `<div style="position:absolute;left:${60 + i * 34}px;top:${y}px">${stampCard({ color: c, stamped: [6, 9, 3, 8][i], w: 520, rot: r })}</div>`).join('');
add('02-quantos-cartoes', shell('navy', (T) => `
  <h1 class="m">Quantos cartões de fidelidade você tem na carteira?</h1>
  <div style="position:relative;height:560px;margin-top:6px">${pile}</div>
  <p class="lead" style="color:${T.mut}">Spoiler: em todos faltava <b style="color:${LIME}">só 1 carimbo.</b> 😅</p>`,
  { deco: blob('rgba(33,80,201,.5)', 700, 520, 760) }));

// 03 — pontos na palma da mão
add('03-palma-da-mao', shell('blue', (T) => `
  <div style="display:flex;align-items:center;gap:36px">
    <div style="flex:1"><h1 class="m">Seus pontos<br>na <span style="color:${LIME}">palma da mão.</span></h1></div>
  </div>
  <div style="display:flex;justify-content:center;margin-top:-6px"><div style="transform:rotate(-4deg);zoom:1.3">${phone(walletScreen())}</div></div>
  <p class="lead" style="color:${T.mut};text-align:center">Sem cartão. Sem carimbo. Sem app para baixar.</p>`,
  { deco: blob('rgba(198,244,50,.2)', 620, -160, 700) + blob('rgba(15,31,61,.3)', 520, 700, -140), extra: sticker('abre no navegador ✨', LIME, NAVY, 640, 330, 7) }));

// 04 — Cartãozinho x Fidelize
const col = (title, ok, items, bg, fg, hi) => `<div style="flex:1;background:${bg};color:${fg};border-radius:36px;padding:38px 34px"><div style="font-size:40px;font-weight:800;margin-bottom:24px">${title}</div><ul class="l">${items.map((i) => `<li style="font-size:34px"><b style="background:${ok ? hi : 'rgba(0,0,0,.12)'};color:${ok ? NAVY : RED}">${ok ? '✓' : '✕'}</b>${i}</li>`).join('')}</ul></div>`;
add('04-cartaozinho-x-fidelize', shell('light', (T) => `
  <h1 class="m">Cartãozinho<br>vs. <span style="color:${BLUE}">Fidelize</span></h1>
  <div class="row">
    ${col('🗂️ Cartão', false, ['Esquece em casa', 'Amassa e molha', 'Ninguém sabe o saldo', 'Perdeu? Recomeça do zero'], '#fff', NAVY, '')}
    ${col('📱 Fidelize', true, ['Está no celular', 'Saldo sempre à vista', 'Prêmios à mostra', 'Nada para perder'], NAVY, '#fff', LIME)}
  </div>`, { deco: blob('rgba(198,244,50,.5)', 520, 640, -180) }));

// 05 — celular nunca esquece
add('05-celular-nunca-esquece', shell('pink', (T) => `
  <h1>Ele esquece o cartão em casa.<br>O celular, <span style="background:${NAVY};color:${PINK};padding:0 18px;border-radius:20px">nunca.</span></h1>
  <div style="display:flex;justify-content:center;gap:0;align-items:center;margin-top:10px"><div style="transform:rotate(-8deg);margin-right:-60px;opacity:.9">${stampCard({ color: LIGHT, stamped: 4, w: 460, rot: 0, torn: true })}</div><div style="transform:rotate(5deg)">${phone(walletScreen('860', 57, 'Faltam 640 pts para o brinde 🎁'))}</div></div>`,
  { deco: blob('rgba(255,255,255,.3)', 600, -200, 760), extra: sticker('FIM do "esqueci" 🙌', NAVY, LIME, 70, 640, -7) }));

// 06 — quem imprime e carimba
add('06-aposente-o-carimbo', shell('navy', (T) => `
  <div style="display:flex;justify-content:center;position:relative"><div style="transform:rotate(-6deg)">${stampCard({ color: SUN, stamped: 10, w: 640 })}</div>${sticker('APOSENTADO', RED, '#fff', 400, 110, 12)}</div>
  <h1 class="m">Aposente o<br><span style="color:${LIME}">carimbo.</span></h1>
  <ul class="l"><li><b style="background:${LIME};color:${NAVY}">✓</b>Sem imprimir cartão</li><li><b style="background:${LIME};color:${NAVY}">✓</b>Sem carimbar na correria</li><li><b style="background:${LIME};color:${NAVY}">✓</b>Sem cliente reclamando que perdeu</li></ul>`,
  { deco: blob('rgba(33,80,201,.55)', 700, 480, 740) }));

// 07 — linha do tempo
const tl = (a, b, emoA, emoB) => `<div style="display:flex;align-items:center;gap:22px;background:rgba(15,31,61,.08);border-radius:34px;padding:28px 34px"><div style="font-size:70px">${emoA}</div><div style="flex:1;font-size:32px;font-weight:600;opacity:.75;text-decoration:line-through">${a}</div><div style="font-size:50px">→</div><div style="font-size:70px">${emoB}</div><div style="flex:1.1;font-size:36px;font-weight:800">${b}</div></div>`;
add('07-toda-mudanca', shell('sun', (T) => `
  <h1 class="m">Toda mudança<br>começa assim.</h1>
  <div style="display:flex;flex-direction:column;gap:20px">${tl('Fita cassete', 'Música no celular', '📼', '🎧')}${tl('Mapa de papel', 'GPS no bolso', '🗺️', '📍')}${tl('Cartão de carimbo', 'Pontos no celular', '🗂️', '💚')}</div>
  <p class="lead" style="color:${T.mut}">A fidelidade também entrou na era do celular.</p>`,
  { deco: blob('rgba(255,255,255,.35)', 560, 640, -180) }));

// 08 — história triste do carimbo 9/10
const panel = (emo, txt, bg) => `<div style="flex:1;background:${bg};border-radius:34px;padding:30px 22px;text-align:center"><div style="font-size:110px;line-height:1">${emo}</div><div style="font-size:30px;font-weight:700;margin-top:14px;line-height:1.2">${txt}</div></div>`;
add('08-nove-de-dez', shell('light', (T) => `
  <h1 class="m">A triste história do carimbo <span style="color:${RED}">9 de 10.</span></h1>
  <div class="row">${panel('😃', 'Cliente junta 9 carimbos', '#fff')}${panel('🧥', 'Troca de casaco. Cartão fica no bolso', '#fff')}${panel('😭', 'Recomeça do zero', '#FFE3E3')}</div>
  <p class="lead" style="color:${T.mut}">No Fidelize não tem bolso, nem gaveta, nem recomeço: os pontos ficam guardados na carteira dele, no celular.</p>`,
  { deco: blob('rgba(33,80,201,.1)', 600, 560, 800) }));

// 09 — mudança de mercado / CTA
add('09-cta-mudanca', shell('blue', (T) => `
  <h1>Faça parte da<br>mudança. <span style="color:${LIME}">Sem cartãozinho.</span></h1>
  <div style="display:flex;justify-content:center"><div style="transform:rotate(3deg);zoom:1.25">${phone(walletScreen('1.500', 100, 'Prêmio liberado! 🎉'))}</div></div>
  <div class="row" style="justify-content:center"><span style="background:${LIME};color:${NAVY};font-weight:800;font-size:36px;padding:20px 40px;border-radius:999px">Link na bio ↑</span></div>`,
  { deco: blob('rgba(198,244,50,.2)', 700, -220, 760) + blob('rgba(15,31,61,.3)', 500, 640, -160) }));

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const p of pieces) { await pg.setContent(p.html); await pg.waitForTimeout(150); await pg.screenshot({ path: path.join(OUT, p.file + '.png') }); console.log('ok', p.file); }
await b.close();
