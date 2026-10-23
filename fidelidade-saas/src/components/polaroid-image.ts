'use client';

import { POLAROID, POLAROID_COMMENT_MAX_LINES, wrapLines } from '@/lib/polaroid';

export type PolaroidInput = {
  photoUrl: string;
  placeName: string;
  rating: number;
  likes: number;
  comment?: string | null;
  /** Quem publica (@ do Instagram, quando cadastrado); aparece no canto da moldura. */
  handle?: string | null;
  /** Nome do autor da indicação, quando não há @. */
  authorName?: string | null;
  host: string;
};

const NAVY = '#0B1B3A';
const LIMA = '#C6F432';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Estrela de 5 pontas centrada em (cx, cy), raio externo r. */
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Coração centrado em (cx, cy), largura aproximada w. */
function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  const s = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.7, cy - s * 1.1, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.1, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9);
  ctx.closePath();
}

/** O símbolo do Fidelize (mesmo desenho de LogoMark), de lado `s`. */
function logo(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const k = s / 64;
  ctx.fillStyle = LIMA;
  roundRect(ctx, x, y, s, s, 16 * k);
  ctx.fill();
  ctx.fillStyle = NAVY;
  const rr = (rx: number, ry: number, w: number, h: number) => { roundRect(ctx, x + (rx - 1) * k, y + ry * k, w * k, h * k, 5 * k); ctx.fill(); };
  rr(18, 12, 10, 40); rr(18, 12, 30, 10); rr(18, 27, 21, 10);
  ctx.beginPath(); ctx.arc(x + (43.5 - 1) * k, y + 47 * k, 5.4 * k, 0, Math.PI * 2); ctx.fill();
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

/**
 * Desenha a indicação como uma Polaroid em formato de story (1080×1920): foto, nome do lugar, nota, curtidas e comentário na moldura,
 * com a marca do Fidelize em cima e o endereço do app embaixo. Devolve um PNG.
 */
export async function renderPolaroid(input: PolaroidInput): Promise<Blob> {
  const { width: W, height: H, cardX, cardY, cardW, pad, photo, captionH, tilt } = POLAROID;
  const cardH = pad + photo + captionH;
  const img = await loadImage(input.photoUrl);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');

  // fundo azul-marinho com brilho lima
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0B1B3A'); bg.addColorStop(0.55, '#16305F'); bg.addColorStop(1, '#0B1B3A');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.9, 120, 0, W * 0.9, 120, 700);
  glow.addColorStop(0, 'rgba(198,244,50,.32)'); glow.addColorStop(1, 'rgba(198,244,50,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // marca no topo
  ctx.textBaseline = 'alphabetic';
  logo(ctx, W / 2 - 215, 118, 110);
  ctx.fillStyle = '#fff';
  ctx.font = `800 104px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('fidelize', W / 2 - 85, 207);

  // moldura inclinada
  ctx.save();
  ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.translate(-cardW / 2, -cardH / 2);
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 28;
  ctx.fillStyle = '#FFFEFA';
  roundRect(ctx, 0, 0, cardW, cardH, 18); ctx.fill();
  ctx.shadowColor = 'transparent';

  // foto quadrada (recorte central)
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.save();
  roundRect(ctx, pad, pad, photo, photo, 6); ctx.clip();
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, pad, pad, photo, photo);
  ctx.restore();

  // legenda da Polaroid
  const left = pad, maxW = photo;
  let y = pad + photo + 78;
  ctx.textAlign = 'left';
  ctx.fillStyle = NAVY;
  let size = 60;
  ctx.font = `800 ${size}px ${FONT}`;
  while (ctx.measureText(input.placeName).width > maxW && size > 34) { size -= 2; ctx.font = `800 ${size}px ${FONT}`; }
  let name = input.placeName;
  while (ctx.measureText(name).width > maxW && name.length > 1) name = name.slice(0, -1);
  ctx.fillText(name === input.placeName ? name : `${name.trimEnd()}…`, left, y);

  y += 56;
  const r = 20;
  for (let i = 0; i < 5; i++) { star(ctx, left + r + i * (r * 2 + 8), y - 10, r); ctx.fillStyle = i < input.rating ? '#F5B301' : '#E2E6EE'; ctx.fill(); }
  const hx = left + maxW - 150;
  heart(ctx, hx, y - 12, 38); ctx.fillStyle = '#E11D48'; ctx.fill();
  ctx.fillStyle = NAVY; ctx.font = `800 44px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillText(String(input.likes), hx + 34, y + 3);

  if (input.comment) {
    ctx.font = `italic 500 40px ${FONT}`; ctx.fillStyle = '#334155';
    const lines = wrapLines(`“${input.comment}”`, (s) => ctx.measureText(s).width, maxW, POLAROID_COMMENT_MAX_LINES);
    y += 62;
    for (const l of lines) { ctx.fillText(l, left, y); y += 50; }
  }

  const by = input.handle ? `@${input.handle}` : input.authorName ?? '';
  if (by) {
    ctx.font = `700 32px ${FONT}`; ctx.fillStyle = '#64748B'; ctx.textAlign = 'right';
    ctx.fillText(by, left + maxW, cardH - 34);
  }
  ctx.restore();

  // rodapé
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `700 46px ${FONT}`;
  ctx.fillText('Ganhe pontos nos seus lugares favoritos', W / 2, 1700);
  ctx.fillStyle = LIMA; ctx.font = `800 46px ${FONT}`;
  ctx.fillText(input.host, W / 2, 1770);

  return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('sem imagem'))), 'image/png'));
}
