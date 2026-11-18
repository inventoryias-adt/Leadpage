// Gera os ícones do app a partir do F do logo (dourado sobre verde-floresta, numa cor só).
// Uso: node scripts/gerar-icones.mjs   (precisa do `sharp` e do ImageMagick `convert` para o favicon.ico)
// Mantenha o desenho igual a src/components/Brand.tsx.
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const INK = '#12241C'; // verde-floresta escuro
const OURO = '#E9C46A';
const ACAO = '#1E5B43';
const PAPEL = '#F5F3EC';
const SHAPE = (fill) => `<rect x="18" y="12" width="10" height="40" rx="5" fill="${fill}"/><rect x="18" y="12" width="30" height="10" rx="5" fill="${fill}"/><rect x="18" y="27" width="21" height="10" rx="5" fill="${fill}"/>`;

/** Quadrado N×N com o F centralizado; `ratio` é a altura do F em relação ao lado. */
const tile = (n, bg, fg, ratio, radius = 0) => {
  const s = (n * ratio) / 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}"><rect width="${n}" height="${n}" rx="${radius}" fill="${bg}"/><g transform="translate(${n / 2 - 33 * s} ${n / 2 - 32 * s}) scale(${s})">${SHAPE(fg)}</g></svg>`;
};

const png = (file, svg) => sharp(Buffer.from(svg)).png().toFile(file);
const pub = (f) => new URL(`../public/${f}`, import.meta.url).pathname;

const jobs = [
  // app do cliente: F dourado sobre verde-floresta
  ['icon-48.png', tile(48, INK, OURO, 0.58)],
  ['icon-96.png', tile(96, INK, OURO, 0.58)],
  ['icon-192.png', tile(192, INK, OURO, 0.58)],
  ['icon-512.png', tile(512, INK, OURO, 0.58)],
  ['icon-maskable-512.png', tile(512, INK, OURO, 0.44)],
  ['apple-touch-icon.png', tile(180, INK, OURO, 0.58)],
  // app do gestor: fundo verde de ação com o F em creme, para ser diferente na tela inicial
  ['gestor-icon-96.png', tile(96, ACAO, PAPEL, 0.58)],
  ['gestor-icon-192.png', tile(192, ACAO, PAPEL, 0.58)],
  ['gestor-icon-512.png', tile(512, ACAO, PAPEL, 0.58)],
  ['gestor-icon-maskable-512.png', tile(512, ACAO, PAPEL, 0.44)],
  ['gestor-apple-touch-icon.png', tile(180, ACAO, PAPEL, 0.58)],
];
for (const [f, svg] of jobs) await png(pub(f), svg);

// favicon.ico (16, 32 e 48 px) em verde-floresta, que lê bem em aba clara e escura
const dir = mkdtempSync(join(tmpdir(), 'fz-ico-'));
const parts = [];
for (const n of [16, 32, 48]) {
  const f = join(dir, `${n}.png`);
  await png(f, tile(n, INK, OURO, 0.66, Math.round(n * 0.22)));
  parts.push(f);
}
execFileSync('convert', [...parts, pub('favicon.ico')]);
rmSync(dir, { recursive: true, force: true });

// SVGs
writeFileSync(new URL('../src/app/icon.svg', import.meta.url), tile(64, INK, OURO, 0.62, 14).replace(' width="64" height="64"', ''));
writeFileSync(pub('logo.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="17 11 32 42">${SHAPE(ACAO)}</svg>`);
console.log('ícones gerados');
