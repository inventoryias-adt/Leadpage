// Gera os ícones do app a partir do F do logo (degradê leve do azul para o verde).
// Uso: node scripts/gerar-icones.mjs   (precisa do `sharp` e do ImageMagick `convert` para o favicon.ico)
// Mantenha o desenho igual a src/components/Brand.tsx.
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BLUE = '#2F63E6';
const GREEN = '#7BE08A';
const NAVY = '#0B1B3A';
const ICE = '#F4F8FF';
const F = (id) => `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="19" y1="12" x2="47" y2="52"><stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${GREEN}"/></linearGradient></defs>`;
const SHAPE = (id) => `<rect x="18" y="12" width="10" height="40" rx="5" fill="url(#${id})"/><rect x="18" y="12" width="30" height="10" rx="5" fill="url(#${id})"/><rect x="18" y="27" width="21" height="10" rx="5" fill="url(#${id})"/>`;

/** Quadrado N×N com o F centralizado; `ratio` é a altura do F em relação ao lado. */
const tile = (n, bg, ratio, radius = 0) => {
  const s = (n * ratio) / 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}">${F('g')}<rect width="${n}" height="${n}" rx="${radius}" fill="${bg}"/><g transform="translate(${n / 2 - 33 * s} ${n / 2 - 32 * s}) scale(${s})">${SHAPE('g')}</g></svg>`;
};

const png = (file, svg) => sharp(Buffer.from(svg)).png().toFile(file);
const pub = (f) => new URL(`../public/${f}`, import.meta.url).pathname;

const jobs = [
  // app do cliente: fundo claro com o F em degradê
  ['icon-48.png', tile(48, ICE, 0.58)],
  ['icon-96.png', tile(96, ICE, 0.58)],
  ['icon-192.png', tile(192, ICE, 0.58)],
  ['icon-512.png', tile(512, ICE, 0.58)],
  ['icon-maskable-512.png', tile(512, ICE, 0.44)],
  ['apple-touch-icon.png', tile(180, ICE, 0.58)],
  // app do gestor: fundo marinho, para ser diferente na tela inicial
  ['gestor-icon-96.png', tile(96, NAVY, 0.58)],
  ['gestor-icon-192.png', tile(192, NAVY, 0.58)],
  ['gestor-icon-512.png', tile(512, NAVY, 0.58)],
  ['gestor-icon-maskable-512.png', tile(512, NAVY, 0.44)],
  ['gestor-apple-touch-icon.png', tile(180, NAVY, 0.58)],
];
for (const [f, svg] of jobs) await png(pub(f), svg);

// favicon.ico (16, 32 e 48 px) em marinho, que lê bem em aba clara e escura
const dir = mkdtempSync(join(tmpdir(), 'fz-ico-'));
const parts = [];
for (const n of [16, 32, 48]) {
  const f = join(dir, `${n}.png`);
  await png(f, tile(n, NAVY, 0.66, Math.round(n * 0.22)));
  parts.push(f);
}
execFileSync('convert', [...parts, pub('favicon.ico')]);
rmSync(dir, { recursive: true, force: true });

// SVGs
writeFileSync(new URL('../src/app/icon.svg', import.meta.url), tile(64, NAVY, 0.62, 14).replace(' width="64" height="64"', ''));
writeFileSync(pub('logo.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="17 11 32 42">${F('g')}${SHAPE('g')}</svg>`);
console.log('ícones gerados');
