// Série 3 — formatos variados para manter o perfil ativo. Uso: node marketing/instagram/build3.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'png-serie3');
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
const chip = (t, bg, fg) => `<span style="display:inline-block;background:${bg};color:${fg};font-weight:700;font-size:32px;padding:14px 28px;border-radius:999px">${t}</span>`;

// 01 — ENQUETE: qual prêmio você escolheria?
const opt = (emo, t, bg, fg) => `<div style="flex:1;background:${bg};color:${fg};border-radius:40px;padding:44px 20px;text-align:center"><div style="font-size:130px;line-height:1">${emo}</div><div style="font-size:40px;font-weight:800;margin-top:18px">${t}</div></div>`;
add('01-enquete-premio', shell('pink', (T) => `
  <div>${chip('ENQUETE 🗳️', NAVY, LIME)}</div>
  <h1 class="m">Seu cliente fiel<br>ganha qual prêmio?</h1>
  <div class="row">${opt('☕', 'Um café grátis', '#fff', NAVY)}${opt('🏷️', '10% de desconto', NAVY, '#fff')}</div>
  <p class="lead" style="color:${T.mut}">Vote nos comentários: <b>A</b> ou <b>B</b>? No Fidelize quem escolhe o prêmio é você.</p>`,
  { deco: blob('rgba(255,255,255,.3)', 620, 560, 800) }));

// 02 — MEME: "quanto falta pra eu ganhar?"
add('02-meme-quanto-falta', shell('light', (T) => `
  <h1 class="m">Cliente: "Quanto falta pra eu ganhar o prêmio?"</h1>
  <div class="row" style="align-items:stretch">
    <div style="flex:1;background:#fff;border-radius:36px;padding:36px;border:2px solid #E5E7EB;text-align:center"><div style="font-size:110px">😰</div><div style="font-size:34px;font-weight:800;margin-top:10px">Você, com o cartão de papel</div><div style="font-size:30px;color:${T.mut};margin-top:10px">"Deixa eu contar os carimbos aqui... acho que 7?"</div></div>
    <div style="flex:1;background:${NAVY};color:#fff;border-radius:36px;padding:36px;text-align:center"><div style="font-size:110px">😎</div><div style="font-size:34px;font-weight:800;margin-top:10px">Você, com o Fidelize</div><div style="font-size:30px;color:${LIME};margin-top:10px">"Faltam 260 pontos. Dá uma olhada no celular!"</div></div>
  </div>`, { deco: blob('rgba(198,244,50,.45)', 520, 640, -180) }));

// 03 — DICAS: ideias de prêmio
const idea = (n, t, s) => `<div style="display:flex;gap:24px;align-items:center;background:rgba(255,255,255,.12);border-radius:30px;padding:18px 30px"><div style="flex:none;width:64px;height:64px;border-radius:50%;background:${LIME};color:${NAVY};font-size:40px;font-weight:800;display:flex;align-items:center;justify-content:center">${n}</div><div><div style="font-size:38px;font-weight:700">${t}</div><div style="font-size:28px;opacity:.75;margin-top:2px">${s}</div></div></div>`;
add('03-dica-ideias-de-premio', shell('navy', (T) => `
  <div>${chip('DICA 💡', LIME, NAVY)}</div>
  <h1 class="sm">5 ideias de prêmio que o cliente <span style="color:${LIME}">adora</span></h1>
  <div style="display:flex;flex-direction:column;gap:12px">${idea(1, 'Um item da casa', 'café, doce, bebida ou adicional')}${idea(2, 'Desconto na próxima compra', 'um motivo para voltar logo')}${idea(3, 'Serviço extra', 'hidratação, barba, massagem rápida')}${idea(4, 'Brinde de marca', 'caneca, sacola, ecobag')}${idea(5, 'Algo só de cliente fiel', 'um combo que ninguém mais compra')}</div>
  `,
  { deco: blob('rgba(33,80,201,.5)', 640, 560, 820) }));

// 04 — MITO x VERDADE
add('04-mito-ou-verdade', shell('sun', (T) => `
  <div>${chip('MITO OU VERDADE?', NAVY, SUN)}</div>
  <h1 class="m">"Programa de fidelidade é coisa de empresa grande."</h1>
  <div style="display:flex;flex-direction:column;gap:18px">
    <div style="background:${RED};color:#fff;border-radius:34px;padding:34px 38px;font-size:60px;font-weight:900;letter-spacing:-1px">MITO ✕</div>
    <div style="background:${NAVY};color:#fff;border-radius:34px;padding:34px 38px;font-size:36px;line-height:1.35;font-weight:600">Qualquer lugar com balcão ou atendimento pode ter o seu. É um plano único: <span style="color:${LIME}">R$ 39,90 no primeiro mês</span> e depois R$ 69,90 por mês, sem taxa de adesão.</div>
  </div>`, { deco: blob('rgba(255,255,255,.35)', 560, 640, -180) }));

// 05 — EXEMPLO NA PRÁTICA: R$ 80 → 800 pontos → prêmio
const stepBox = (emo, big, small, bg, fg) => `<div style="flex:1;background:${bg};color:${fg};border-radius:36px;padding:34px 18px;text-align:center"><div style="font-size:90px;line-height:1">${emo}</div><div style="font-size:50px;font-weight:800;letter-spacing:-1px;margin-top:14px">${big}</div><div style="font-size:26px;font-weight:600;opacity:.8;margin-top:6px">${small}</div></div>`;
add('05-exemplo-na-pratica', shell('blue', (T) => `
  <div>${chip('NA PRÁTICA 🧮', LIME, NAVY)}</div>
  <h1 class="m">Como os pontos <span style="color:${LIME}">crescem</span></h1>
  <div class="row" style="align-items:center;gap:12px">${stepBox('🛍️', 'R$ 80', 'compra da Maria', '#fff', NAVY)}<div style="font-size:54px;color:${LIME}">→</div>${stepBox('⭐', '800 pts', 'R$ 1 = 10 pontos', NAVY, '#fff')}<div style="font-size:54px;color:${LIME}">→</div>${stepBox('🎁', '1.500', 'pontos = prêmio', LIME, NAVY)}</div>
  <p class="lead" style="color:${T.mut}">Duas visitas e ela já troca por um prêmio. As regras (quantos pontos por real e quanto custa cada prêmio) são suas.</p>
  <p style="font-size:24px;color:${T.mut}">Exemplo ilustrativo.</p>`,
  { deco: blob('rgba(198,244,50,.2)', 640, -160, 760) + blob('rgba(15,31,61,.3)', 480, 700, -140) }));

// 06 — PARA QUEM É: segmentos
const seg = (emo, t) => `<div style="background:#fff;border-radius:34px;padding:34px 16px;text-align:center;border:2px solid #E5E7EB"><div style="font-size:100px;line-height:1">${emo}</div><div style="font-size:34px;font-weight:800;margin-top:12px">${t}</div></div>`;
add('06-para-quem-e', shell('light', (T) => `
  <h1 class="m">O Fidelize é <span style="color:${BLUE}">para o seu negócio</span> também</h1>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">${seg('☕', 'Cafeteria')}${seg('🥐', 'Padaria')}${seg('💈', 'Barbearia')}${seg('💇', 'Salão')}${seg('💆', 'Estética')}${seg('🍔', 'Restaurante')}</div>
  <p class="lead" style="color:${T.mut}">Qualquer lugar com balcão ou atendimento. Quem atende com hora marcada ainda usa a agenda do app.</p>`,
  { deco: blob('rgba(198,244,50,.5)', 520, 640, -180) }));

// 07 — ANIVERSÁRIO
add('07-aniversario', shell('pink', (T) => `
  <div>${chip('DATA ESPECIAL 🎂', NAVY, PINK)}</div>
  <h1>Parabéns<br>pra você! 🎉</h1>
  <div class="pcard" style="background:${NAVY};border-radius:40px;padding:40px;display:flex;align-items:center;gap:30px"><div style="font-size:120px;line-height:1">🎁</div><div><div style="font-size:30px;color:#B7C2DB;font-weight:600">Presente de aniversário</div><div style="font-size:70px;font-weight:800;color:${LIME};letter-spacing:-2px">+200 pontos</div></div></div>
  <p class="lead" style="color:${T.mut}">Se você ativar, o cliente ganha pontos de presente no aniversário. Um jeito simples de dizer "a gente lembrou de você".</p>
  <p style="font-size:24px;color:${T.mut}">Valor ilustrativo: você define quantos pontos dar.</p>`,
  { deco: blob('rgba(255,255,255,.3)', 620, 560, 800) }));

// 08 — CHECK-IN
add('08-checkin', shell('lime', (T) => `
  <div>${chip('CHECK-IN 📍', NAVY, LIME)}</div>
  <h1>Chegou?<br>Ganhou.</h1>
  <div style="display:flex;align-items:center;gap:30px;background:${NAVY};color:#fff;border-radius:40px;padding:40px"><div style="font-size:130px;line-height:1">📍</div><div style="font-size:38px;line-height:1.3;font-weight:600">O cliente faz check-in <span style="color:${LIME}">no local</span> e ganha pontos. Uma vez por dia.</div></div>
  <p class="lead" style="color:${T.mut}">Você define o raio e quantos pontos vale. É um empurrãozinho para o cliente aparecer.</p>`,
  { deco: blob('rgba(15,31,61,.08)', 640, 560, -200) }));

// 09 — PEDIDO COM RETIRADA
add('09-pedido-retirada', shell('navy', (T) => `
  <div>${chip('PEDIDOS 🛍️', LIME, NAVY)}</div>
  <h1 class="m">Peça antes.<br><span style="color:${LIME}">Retire sem fila.</span></h1>
  <div style="display:flex;justify-content:center"><div style="transform:rotate(3deg)">${phone(`
    <div style="font-weight:800;font-size:28px;margin-bottom:14px">Seu pedido</div>
    <div style="background:#fff;border-radius:22px;padding:18px 20px;border:2px solid #E5E7EB;font-size:26px;font-weight:700;display:flex;justify-content:space-between"><span>Café + pão de queijo</span><span>R$ 14,00</span></div>
    <div style="background:${LIME};border-radius:22px;padding:18px 20px;margin-top:14px;font-size:26px;font-weight:800;text-align:center">Retirar no balcão ✔</div>
    <div style="font-size:22px;margin-top:14px;color:#5B6783;text-align:center">Você recebe um código para retirar</div>`)}</div></div>
  <p class="lead" style="color:${T.mut}">O cliente escolhe no cardápio do app e retira com um código. Menos espera no balcão.</p>`,
  { deco: blob('rgba(33,80,201,.55)', 700, 480, 760) }));

// 10 — FAQ rápido
const qa = (q, a) => `<div style="background:#fff;border-radius:30px;padding:30px 34px;border:2px solid #E5E7EB"><div style="font-size:38px;font-weight:800;letter-spacing:-.5px">${q}</div><div style="font-size:30px;color:#5B6783;margin-top:8px;line-height:1.3">${a}</div></div>`;
add('10-faq-rapido', shell('light', (T) => `
  <div>${chip('PERGUNTAS RÁPIDAS ❓', NAVY, LIME)}</div>
  <h1 class="m">Você perguntou,<br><span style="color:${BLUE}">a gente respondeu.</span></h1>
  <div style="display:flex;flex-direction:column;gap:16px">${qa('O cliente precisa baixar app?', 'Não. Abre pelo navegador e pode adicionar à tela inicial.')}${qa('Tem fidelidade no contrato?', 'Não. Você cancela quando quiser.')}${qa('Posso ter mais de uma loja?', 'Pode. Os pontos valem em todas as unidades.')}</div>`,
  { deco: blob('rgba(198,244,50,.45)', 520, 640, -180) }));

// 11 — FRASE (bônus)
add('11-frase', shell('blue', (T) => `
  <p style="font-size:200px;line-height:.6;color:${LIME};font-weight:900;height:110px">“</p>
  <h1>Cliente fiel não é sorte.<br><span style="color:${LIME}">É motivo.</span></h1>
  <p class="lead" style="color:${T.mut}">Dê um motivo para o seu cliente voltar amanhã.</p>`,
  { deco: blob('rgba(198,244,50,.2)', 700, -220, 760) + blob('rgba(15,31,61,.3)', 500, 640, -160) }));

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const p of pieces) { await pg.setContent(p.html); await pg.waitForTimeout(150); await pg.screenshot({ path: path.join(OUT, p.file + '.png') }); console.log('ok', p.file); }
await b.close();
