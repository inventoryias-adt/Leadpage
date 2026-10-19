// Gera os criativos de Instagram (1080x1350) a partir dos dados abaixo. Uso: node marketing/instagram/build.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'png');
fs.mkdirSync(OUT, { recursive: true });

const NAVY = '#0F1F3D', LIME = '#C6F432', BLUE = '#2150C9', LIGHT = '#F7F8FA';
const logo = (fill = LIME, ink = '#0B1B3A') => `<svg viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="16" fill="${fill}"/><g transform="translate(-1 0)"><rect x="18" y="12" width="10" height="40" rx="5" fill="${ink}"/><rect x="18" y="12" width="30" height="10" rx="5" fill="${ink}"/><rect x="18" y="27" width="21" height="10" rx="5" fill="${ink}"/><circle cx="43.5" cy="47" r="5.4" fill="${ink}"/></g></svg>`;

const THEMES = {
  navy:  { bg: NAVY,  fg: '#fff', mut: '#B7C2DB', acc: LIME, chip: 'rgba(198,244,50,.14)', card: 'rgba(255,255,255,.07)', logoFill: LIME, logoInk: '#0B1B3A' },
  lime:  { bg: LIME,  fg: NAVY,   mut: '#3C4A1A', acc: NAVY, chip: 'rgba(15,31,61,.10)',   card: 'rgba(15,31,61,.08)',   logoFill: NAVY, logoInk: LIME },
  blue:  { bg: BLUE,  fg: '#fff', mut: '#D3DEFA', acc: LIME, chip: 'rgba(255,255,255,.16)', card: 'rgba(255,255,255,.12)', logoFill: LIME, logoInk: '#0B1B3A' },
  light: { bg: LIGHT, fg: NAVY,   mut: '#5B6783', acc: BLUE, chip: 'rgba(33,80,201,.10)',  card: '#fff',                 logoFill: LIME, logoInk: '#0B1B3A' },
};

const css = `
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;font-family:Inter,'Inter Variable',system-ui,sans-serif;overflow:hidden;position:relative}
.s{width:1080px;height:1350px;padding:84px 84px 72px;display:flex;flex-direction:column;position:relative;overflow:hidden}
.top{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:16px;font-weight:700;font-size:40px;letter-spacing:-1px}
.brand svg{width:56px;height:56px}
.tag{font-size:22px;font-weight:650;letter-spacing:2px;text-transform:uppercase;padding:10px 20px;border-radius:999px}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px;position:relative;z-index:2}
h1{font-size:96px;line-height:1.02;letter-spacing:-3.5px;font-weight:650}
h1.m{font-size:82px}
h1.sm{font-size:70px;letter-spacing:-2.5px}
p.lead{font-size:38px;line-height:1.35;font-weight:450}
.foot{display:flex;align-items:center;justify-content:space-between;font-size:26px;font-weight:550;position:relative;z-index:2}
.dots{display:flex;gap:10px}.dots i{width:14px;height:14px;border-radius:50%;opacity:.3;background:currentColor}.dots i.on{opacity:1;width:38px;border-radius:8px}
.card{border-radius:36px;padding:36px 40px}
.big{font-size:200px;font-weight:700;letter-spacing:-8px;line-height:.95}
.row{display:flex;gap:22px}
.pill{display:inline-flex;align-items:center;gap:12px;border-radius:999px;padding:14px 28px;font-size:30px;font-weight:600}
.deco{position:absolute;border-radius:50%;z-index:1}
ul.l{list-style:none;padding:0;display:flex;flex-direction:column;gap:22px}
ul.l li{display:flex;gap:22px;align-items:flex-start;font-size:38px;line-height:1.25;font-weight:500}
ul.l li b{flex:none;width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700}
.mark{background:linear-gradient(transparent 62%,var(--acc) 62% 92%,transparent 92%);padding:0 4px}
.steps{display:flex;flex-direction:column;gap:20px}
.step{display:flex;gap:28px;align-items:center;border-radius:34px;padding:40px 40px}
.step .n{flex:none;width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:700}
.step h3{font-size:42px;font-weight:650;letter-spacing:-.8px}.step p{font-size:30px;margin-top:4px;opacity:.8}
.bar{height:26px;border-radius:14px;overflow:hidden;display:flex}
`;

const shell = (t, inner, { idx = 0, total = 1, tag = '', deco = '' } = {}) => {
  const T = THEMES[t];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="s" style="background:${T.bg};color:${T.fg};--acc:${T.acc}">
    ${deco}
    <div class="top"><div class="brand">${logo(T.logoFill, T.logoInk)}<span>fidelize</span></div>${tag ? `<span class="tag" style="background:${T.chip};color:${T.fg}">${tag}</span>` : ''}</div>
    <div class="body">${inner(T)}</div>
    <div class="foot"><span style="color:${T.mut}">@usefidelize</span>${total > 1 ? `<div class="dots" style="color:${T.fg}">${Array.from({ length: total }, (_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>` : '<span></span>'}</div>
  </div></body></html>`;
};
const blob = (c, size, x, y) => `<div class="deco" style="width:${size}px;height:${size}px;background:${c};left:${x}px;top:${y}px"></div>`;

const pieces = [];
const add = (file, html) => pieces.push({ file, html });

// ---------- POST 1 — manifesto (navy) ----------
add('01-capa-manifesto', shell('navy', (T) => `
  <h1>Cliente bom<br>é o que <span style="color:${LIME}">volta.</span></h1>
  <p class="lead" style="color:${T.mut}">O Fidelize transforma cada compra em pontos e cada ponto em um motivo para o cliente voltar ao seu negócio.</p>
  <div class="row"><span class="pill" style="background:${LIME};color:${NAVY}">Pontos</span><span class="pill" style="background:${T.chip};color:#fff">Prêmios</span><span class="pill" style="background:${T.chip};color:#fff">Indicação</span></div>`,
  { tag: 'Programa de fidelidade', deco: blob('rgba(33,80,201,.55)', 760, 520, 700) + blob('rgba(198,244,50,.12)', 380, -120, 900) }));

// ---------- POST 2 — como funciona em 4 passos (lime) — carrossel 1/5 ----------
const car1 = [
  ['lime', (T) => `<h1>Como o Fidelize<br>funciona <span style="color:${BLUE}">em 4 passos</span></h1><p class="lead" style="color:${T.mut}">Você configura uma vez. Depois é só lançar a compra e deixar os pontos trabalharem.</p><div class="pill" style="background:${NAVY};color:${LIME};align-self:flex-start">Deslize →</div>`, { tag: 'Passo a passo', deco: blob('rgba(15,31,61,.08)', 700, 560, 760) }],
  ['light', (T) => `<div class="steps"><div class="step card" style="background:#fff"><span class="n" style="background:${BLUE};color:#fff">1</span><div><h3>Você define as regras</h3><p style="color:${T.mut}">Quantos pontos vale cada R$ 1 e quais são os prêmios.</p></div></div></div><h1 class="m" style="margin-top:6px">Primeiro, <span style="color:${BLUE}">as suas regras.</span></h1><p class="lead" style="color:${T.mut}">Exemplo: R$ 1 = 10 pontos e um prêmio de 1.500 pontos. Você escolhe o que faz sentido para o seu negócio.</p>`, { tag: 'Passo 1 de 4' }],
  ['light', (T) => `<div class="steps"><div class="step card" style="background:#fff"><span class="n" style="background:${BLUE};color:#fff">2</span><div><h3>O cliente entra na carteira</h3><p style="color:${T.mut}">Cadastro rápido, pelo celular, sem baixar app.</p></div></div></div><h1 class="m" style="margin-top:6px">Sem baixar nada. <span style="color:${BLUE}">Só abrir.</span></h1><p class="lead" style="color:${T.mut}">A carteira do cliente funciona direto no navegador e pode ser adicionada à tela inicial como um app.</p>`, { tag: 'Passo 2 de 4' }],
  ['light', (T) => `<div class="steps"><div class="step card" style="background:#fff"><span class="n" style="background:${BLUE};color:#fff">3</span><div><h3>Você lança a compra</h3><p style="color:${T.mut}">Pelo CPF do cliente ou por QR Code.</p></div></div></div><h1 class="m" style="margin-top:6px">Duas formas de <span style="color:${BLUE}">lançar os pontos.</span></h1><p class="lead" style="color:${T.mut}">No caixa, digite o CPF. Ou mostre o QR Code e o cliente lê com o próprio celular.</p>`, { tag: 'Passo 3 de 4' }],
  ['navy', (T) => `<div class="steps"><div class="step card" style="background:${T.card}"><span class="n" style="background:${LIME};color:${NAVY}">4</span><div><h3>Os pontos viram prêmios</h3><p style="color:${T.mut}">E o cliente tem motivo para voltar.</p></div></div></div><h1 class="m" style="margin-top:6px">A Maria gasta R$ 80 <span style="color:${LIME}">e já pensa na volta.</span></h1><p class="lead" style="color:${T.mut}">800 pontos hoje, mais 800 na próxima visita: ela troca por um prêmio e sai com um motivo para voltar de novo.</p>`, { tag: 'Passo 4 de 4' }],
];
car1.forEach(([t, f, o], i) => add(`02-passo-a-passo-${i + 1}`, shell(t, f, { ...o, idx: i, total: car1.length })));

// ---------- POST 3 — sem app (blue) ----------
add('03-sem-baixar-app', shell('blue', (T) => `
  <h1>Seu cliente<br>não precisa <span style="color:${LIME}">baixar app.</span></h1>
  <p class="lead" style="color:${T.mut}">A carteira de pontos abre direto no celular, em segundos. Menos atrito, mais gente participando.</p>
  <div class="card" style="background:${T.card};display:flex;align-items:center;gap:30px"><div style="font-size:90px">📱</div><div style="font-size:34px;line-height:1.3;font-weight:550">Abre no navegador.<br><span style="color:${LIME}">Instala na tela inicial</span> se quiser.</div></div>`,
  { tag: 'Praticidade', deco: blob('rgba(198,244,50,.18)', 640, 560, -200) + blob('rgba(15,31,61,.35)', 520, -180, 880) }));

// ---------- POST 4 — pontos por CPF / QR (light) ----------
add('04-cpf-ou-qr', shell('light', (T) => `
  <h1>Lance pontos<br>em <span style="color:${BLUE}">segundos.</span></h1>
  <div class="row" style="gap:26px">
    <div class="card" style="background:#fff;flex:1;border:2px solid #E5E7EB"><div style="font-size:30px;font-weight:650;color:${BLUE};letter-spacing:1px;text-transform:uppercase">Pelo CPF</div><div style="font-size:40px;font-weight:650;margin-top:16px;letter-spacing:-1px;white-space:nowrap">123.456.789-00</div><p style="font-size:28px;color:${T.mut};margin-top:14px">Digite no caixa e pronto.</p></div>
    <div class="card" style="background:${NAVY};color:#fff;flex:1"><div style="font-size:30px;font-weight:650;color:${LIME};letter-spacing:1px;text-transform:uppercase">Por QR Code</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:18px 0;width:190px">${Array.from({ length: 25 }, (_, i) => `<i style="aspect-ratio:1;border-radius:4px;background:${[0,1,2,4,5,6,8,10,12,14,16,18,19,20,22,23,24].includes(i) ? LIME : 'rgba(255,255,255,.18)'}"></i>`).join('')}</div><p style="font-size:28px;color:#B7C2DB">O cliente lê e recebe.</p></div>
  </div>
  <p class="lead" style="color:${T.mut}">Sem maquininha especial, sem planilha. O saldo do cliente atualiza na hora.</p>`,
  { tag: 'Lançamento rápido' }));

// ---------- POST 5 — prêmios (lime) ----------
add('05-premios', shell('lime', (T) => `
  <h1>Você escolhe<br>o <span style="color:${BLUE}">prêmio.</span></h1>
  <p class="lead" style="color:${T.mut}">Um café, um desconto, um serviço grátis, um combo. O Fidelize guarda o saldo e você define o que vale a pena entregar.</p>
  <div class="card" style="background:${NAVY};color:#fff"><div style="display:flex;justify-content:space-between;font-size:30px;font-weight:600"><span>Maria</span><span style="color:${LIME}">1.600 pts</span></div><div class="bar" style="background:rgba(255,255,255,.18);margin:22px 0 14px"><div style="width:100%;background:${LIME}"></div></div><div style="font-size:30px;color:#B7C2DB">Prêmio liberado: 1.500 pontos 🎁</div></div>`,
  { tag: 'Prêmios', deco: blob('rgba(15,31,61,.08)', 620, 600, -160) }));

// ---------- POST 6 — indicação (navy) ----------
add('06-indicacao', shell('navy', (T) => `
  <h1>Quem gosta<br><span style="color:${LIME}">indica.</span></h1>
  <p class="lead" style="color:${T.mut}">Com a indicação, o cliente que traz um amigo ganha pontos quando o amigo faz a primeira compra. Crescimento que nasce da sua própria clientela.</p>
  <div class="row" style="align-items:center;gap:20px"><div class="card" style="background:${T.card};font-size:34px;font-weight:600;text-align:center;flex:1">Maria<br><span style="color:${LIME};font-size:28px">indica</span></div><div style="font-size:60px;color:${LIME}">→</div><div class="card" style="background:${LIME};color:${NAVY};font-size:34px;font-weight:700;text-align:center;flex:1">João<br><span style="font-size:28px">1ª compra</span></div></div>`,
  { tag: 'Indicação', deco: blob('rgba(198,244,50,.10)', 700, 540, 760) }));

// ---------- POST 7 — desafios e campanhas (blue) ----------
add('07-campanhas-desafios', shell('blue', (T) => `
  <h1>Pontos em<br><span style="color:${LIME}">dobro</span> na terça?</h1>
  <p class="lead" style="color:${T.mut}">Crie campanhas e desafios para movimentar os dias fracos, lançar um produto novo ou premiar quem vem mais vezes.</p>
  <ul class="l"><li><b style="background:${LIME};color:${NAVY}">✓</b>Campanhas de pontos com prazo</li><li><b style="background:${LIME};color:${NAVY}">✓</b>Desafios da casa para o cliente cumprir</li><li><b style="background:${LIME};color:${NAVY}">✓</b>Ofertas em destaque com estoque</li></ul>`,
  { tag: 'Campanhas', deco: blob('rgba(198,244,50,.16)', 560, -140, 760) + blob('rgba(15,31,61,.3)', 460, 700, -160) }));

// ---------- POST 8 — agenda e reservas (light) ----------
add('08-agenda-reservas', shell('light', (T) => `
  <h1>Agenda,<br>reserva <span style="color:${BLUE}">e pontos.</span></h1>
  <p class="lead" style="color:${T.mut}">Para barbearia, salão, clínica ou restaurante: o cliente escolhe o profissional e o horário, e recebe lembrete antes de ir.</p>
  <div class="card" style="background:#fff;border:2px solid #E5E7EB;display:flex;flex-direction:column;gap:16px">${[['10:00', 'Corte · Lucas', BLUE], ['10:15', 'Barba · Ana', '#16A34A'], ['14:00', 'Escova · Ana', '#D97706']].map(([h, n, c]) => `<div style="display:flex;gap:22px;align-items:center"><span style="font-size:30px;font-weight:650;width:110px;color:${T.mut}">${h}</span><span style="flex:1;border-left:10px solid ${c};background:${c}1A;border-radius:16px;padding:18px 24px;font-size:32px;font-weight:600">${n}</span></div>`).join('')}</div>`,
  { tag: 'Agenda' }));

// ---------- POST 9 — painel de números (navy) ----------
add('09-painel-numeros', shell('navy', (T) => `
  <h1>Veja quem<br>volta <span style="color:${LIME}">e quanto.</span></h1>
  <p class="lead" style="color:${T.mut}">O painel mostra pontuações, resgates e clientes para você decidir com números, e não no palpite.</p>
  <div class="row" style="gap:20px">${[['Pontuações', '1.284'], ['Resgates', '96'], ['Clientes', '412']].map(([l, v], i) => `<div class="card" style="background:${i === 0 ? LIME : T.card};color:${i === 0 ? NAVY : '#fff'};flex:1;padding:32px 28px"><div style="font-size:26px;font-weight:600;opacity:.85">${l}</div><div style="font-size:64px;font-weight:700;letter-spacing:-2px;margin-top:10px">${v}</div></div>`).join('')}</div>
  <p style="font-size:24px;color:${T.mut}">Valores ilustrativos.</p>`,
  { tag: 'Painel', deco: blob('rgba(33,80,201,.5)', 680, 520, 760) }));

// ---------- POST 10 — manter cliente (lime) ----------
add('10-reter-cliente', shell('lime', (T) => `
  <h1>Conquistar cliente<br>novo <span style="text-decoration:underline;text-decoration-thickness:10px;text-underline-offset:10px">custa caro.</span></h1>
  <p class="lead" style="color:${T.mut}">Fazer o cliente que já conhece você voltar costuma sair mais barato do que atrair alguém do zero. Fidelidade é isso: dar motivo para voltar.</p>
  <div class="card" style="background:${NAVY};color:#fff;font-size:40px;line-height:1.3;font-weight:550">Quem volta, <span style="color:${LIME}">gasta de novo</span> e ainda <span style="color:${LIME}">traz amigos.</span></div>`,
  { tag: 'Retenção', deco: blob('rgba(15,31,61,.07)', 700, 520, 780) }));

// ---------- POST 11 — preço / CTA (navy) ----------
add('11-preco-cta', shell('navy', (T) => `
  <p class="tag" style="background:${T.chip};color:${LIME};align-self:flex-start">Um plano, tudo incluso</p>
  <div><div class="big" style="color:${LIME}">R$ 69,90</div><div style="font-size:44px;font-weight:550;margin-top:10px;color:${T.mut}">por mês</div></div>
  <ul class="l"><li><b style="background:${LIME};color:${NAVY}">✓</b>Sem taxa de adesão</li><li><b style="background:${LIME};color:${NAVY}">✓</b>Sem fidelidade: cancele quando quiser</li><li><b style="background:${LIME};color:${NAVY}">✓</b>Pontos, prêmios, campanhas, agenda e painel</li></ul>`,
  { tag: 'Comece hoje', deco: blob('rgba(33,80,201,.55)', 760, 480, 700) }));

// ---------- POST 12 — chamada final (blue) ----------
add('12-chamada-final', shell('blue', (T) => `
  <h1>Pronto para fazer<br>seu cliente <span style="color:${LIME}">voltar?</span></h1>
  <p class="lead" style="color:${T.mut}">Peça sua conta no link da bio e comece a dar pontos ainda hoje.</p>
  <div class="row"><span class="pill" style="background:${LIME};color:${NAVY};font-size:36px;padding:22px 40px">Link na bio ↑</span></div>`,
  { tag: 'Fidelize', deco: blob('rgba(198,244,50,.18)', 700, 520, 700) + blob('rgba(15,31,61,.3)', 480, -160, 820) }));

// ---------- STORY/PERFIL — foto de perfil (quadrado) ----------
const avatar = `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0}body{width:1080px;height:1080px;background:${NAVY};display:flex;align-items:center;justify-content:center}</style></head><body><svg viewBox="0 0 64 64" width="720" height="720"><rect width="64" height="64" rx="16" fill="${LIME}"/><g transform="translate(-1 0)"><rect x="18" y="12" width="10" height="40" rx="5" fill="#0B1B3A"/><rect x="18" y="12" width="30" height="10" rx="5" fill="#0B1B3A"/><rect x="18" y="27" width="21" height="10" rx="5" fill="#0B1B3A"/><circle cx="43.5" cy="47" r="5.4" fill="#0B1B3A"/></g></svg></body></html>`;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const p of pieces) { await pg.setContent(p.html); await pg.waitForTimeout(150); await pg.screenshot({ path: path.join(OUT, p.file + '.png') }); console.log('ok', p.file); }
await pg.setViewportSize({ width: 1080, height: 1080 }); await pg.setContent(avatar); await pg.screenshot({ path: path.join(OUT, '00-foto-de-perfil.png') });
await b.close();
