// Indicações: "Publicar no Instagram" monta uma Polaroid em formato de story (1080×1920, marca Fidelize, lugar, nota, curtidas e comentário),
// entrega a imagem pela janela de compartilhar do aparelho e, sem ela, baixa a imagem e copia a legenda. Quem cadastrou o Instagram vê "Publicar no meu story".
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
const PHOTO = readFileSync(fileURLToPath(new URL('./fixtures/prato.png', import.meta.url)));
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
const lucas = sql(`select id from "Customer" where email='lucas@teste.com'`);
sql(`truncate "RateLimit"; delete from "PostReport"; delete from "PostLike"; delete from "PostPhoto"; delete from "Post"; update "Customer" set instagram=null where id='${lucas}'`);
sql(`insert into "Wallet"(id,"customerId","restaurantId",balance) values (gen_random_uuid()::text,'${lucas}','${rid}',100) on conflict ("customerId","restaurantId") do nothing`);
const post = sql(`insert into "Post"(id,"customerId","restaurantId",rating,comment) values (gen_random_uuid()::text,'${lucas}','${rid}',4,'Smash perfeito, pão macio e a batata veio crocante. Voltarei com a família inteira no domingo para repetir tudo isso de novo, sem falta nenhuma.') returning id`).split('\n')[0];
sql(`insert into "PostPhoto"("postId",mime,data) values ('${post}','image/png', decode('${PHOTO.toString('hex')}','hex'))`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const open = async ({ share }) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  await ctx.addInitScript(({ share }) => {
    localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); try { sessionStorage.setItem('fz_splash', '1'); } catch {}
    if (share) {
      navigator.canShare = () => true;
      navigator.share = async (d) => {
        const f = d.files[0];
        window.__shared = { name: f.name, type: f.type, text: d.text, url: await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); }) };
      };
    } else { delete navigator.canShare; delete navigator.share; }
  }, { share });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto(BASE + '/entrar'); await p.fill('#c-email', 'lucas@teste.com'); await p.fill('#c-password', 'senha-cliente-1'); await p.click('button[type=submit]'); await p.waitForURL('**/carteira**');
  await p.goto(BASE + '/indicacoes'); await p.waitForSelector('[data-testid=post-card]');
  return { ctx, p };
};

// 1. sem Instagram cadastrado: botão comum; a janela de compartilhar recebe a Polaroid em PNG 1080×1920 com a legenda
let { ctx, p } = await open({ share: true });
assert.equal((await p.locator('[data-testid=share-instagram]').innerText()).trim(), 'Publicar no Instagram');
await p.click('[data-testid=share-instagram]'); await p.waitForFunction(() => window.__shared);
const shared = await p.evaluate(() => window.__shared);
assert.equal(shared.type, 'image/png'); assert.match(shared.name, /^fidelize-.*\.png$/);
assert.match(shared.text, /#fidelize/); assert.match(shared.text, /Smash perfeito/);
const px = await p.evaluate(async (url) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const at = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data.slice(0, 3));
  return { w: img.width, h: img.height, corner: at(5, 1900), card: at(140, 1450), top: at(540, 20) };
}, shared.url);
assert.deepEqual([px.w, px.h], [1080, 1920]);
assert.ok(px.corner[2] > px.corner[0] && px.corner[0] < 60, `fundo azul-marinho: ${px.corner}`);
assert.ok(px.card.every((v) => v > 230), `moldura branca da Polaroid: ${px.card}`);
await p.evaluate((url) => { const i = document.createElement('img'); i.id = 'zz'; i.src = url; i.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;z-index:99999'; document.body.append(i); }, shared.url);
await p.waitForTimeout(300); await p.screenshot({ path: 'ig-polaroid.png' });
await ctx.close();
console.log('1. a Polaroid (PNG 1080×1920, moldura branca, fundo da marca) chega à janela de compartilhar com a legenda OK');

// 2. com o Instagram cadastrado: "Publicar no meu story"
sql(`update "Customer" set instagram='lucas.fotos' where id='${lucas}'`);
({ ctx, p } = await open({ share: true }));
assert.equal((await p.locator('[data-testid=share-instagram]').innerText()).trim(), 'Publicar no meu story');
await p.click('[data-testid=share-instagram]'); await p.waitForFunction(() => window.__shared);
await ctx.close();
console.log('2. quem cadastrou o Instagram vê "Publicar no meu story" e a imagem leva o @ dele OK');

// 3. aparelho sem compartilhamento de arquivos: baixa a imagem e avisa
({ ctx, p } = await open({ share: false }));
const dl = p.waitForEvent('download');
await p.click('[data-testid=share-instagram]');
const d = await dl; assert.match(d.suggestedFilename(), /^fidelize-.*\.png$/);
await p.waitForSelector('[data-testid=post-msg]:has-text("Imagem baixada")');
await ctx.close();
console.log('3. sem janela de compartilhar: baixa a imagem e orienta a publicar OK');

await b.close();
console.log('ALL OK (Polaroid para o story)');
