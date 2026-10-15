import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const open = async (ua, mobile = true, seenIntro = true) => {
  const ctx = await b.newContext({ userAgent: ua, viewport: { width: 390, height: 844 }, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript((seen) => { localStorage.getItem('fz_intro_v1') ?? localStorage.setItem('fz_intro_v1', '1'); if (seen && !sessionStorage.getItem('fz_t')) { sessionStorage.setItem('fz_t', '1'); localStorage.setItem('fz_install_intro_v1', '1'); } }, seenIntro);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return { ctx, p };
};
const strip = (p) => p.locator('button[aria-label^="Mostrar como adicionar"]');
const card = (p) => p.locator('section[aria-label="Adicionar à tela inicial"]');

// 1. desktop: não aparece
{ const { ctx, p } = await open('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', false);
  await p.goto(BASE + '/entrar'); await p.waitForTimeout(1200);
  assert.equal(await card(p).count(), 0); await ctx.close(); }
console.log('1. computador: sem convite OK');

// 1b. primeira visita: pop-up no meio da tela; ao recusar fica o cartão no topo e o pop-up não volta
{ const { ctx, p } = await open(IPHONE, true, false);
  await p.goto(BASE + '/entrar');
  const intro = p.locator('[role=dialog][aria-labelledby=install-intro-title]'); await intro.waitFor();
  await p.screenshot({ path: 'inst-intro.png' });
  const box = await p.locator('[role=dialog] >> div').first().boundingBox().catch(() => null);
  await p.click('[role=dialog] >> text=Agora não');
  assert.equal(await intro.count(), 0, 'recusar fecha o pop-up');
  assert.equal(await card(p).count(), 0, 'o cartão fica comprimido');
  assert.equal(await strip(p).count(), 1, 'numa tira fina no topo, com a seta');
  await p.screenshot({ path: 'inst-strip.png' });
  await p.reload(); await p.waitForTimeout(1200);
  assert.equal(await intro.count(), 0, 'não abre de novo na visita seguinte');
  assert.equal(await strip(p).count(), 1, 'a tira continua fixa');
  await strip(p).click();
  assert.equal(await card(p).count(), 1, 'a seta abre o cartão de novo');
  await p.click('section[aria-label="Adicionar à tela inicial"] >> text=Agora não');
  assert.equal(await card(p).count(), 0); assert.equal(await strip(p).count(), 1, 'Agora não comprime de novo, não some');
  await ctx.close(); }
console.log('1b. primeira visita: pop-up central, recusar deixa o cartão OK');

// 1c. primeira visita no iPhone: o botão do pop-up abre direto o guia
{ const { ctx, p } = await open(IPHONE, true, false);
  await p.goto(BASE + '/entrar'); await p.locator('[role=dialog][aria-labelledby=install-intro-title]').waitFor();
  await p.click('[role=dialog] >> button:has-text("Adicionar à tela inicial")');
  await p.locator('[role=dialog][aria-labelledby=install-guide-title]').waitFor();
  assert.equal(await p.locator('[role=dialog][aria-labelledby=install-intro-title]').count(), 0);
  await ctx.close(); }
console.log('1c. pop-up: um toque abre o guia do iPhone OK');

// 1d. valor antigo de "dispensado" (versão anterior) não esconde nada: pop-up na primeira visita e depois a tira
{ const { ctx, p } = await open(IPHONE, true, false);
  await p.addInitScript(() => localStorage.setItem('fz_install_dismissed_v1', String(Date.now())));
  await p.goto(BASE + '/entrar');
  await p.locator('[role=dialog][aria-labelledby=install-intro-title]').waitFor();
  await p.click('[role=dialog] >> text=Agora não');
  assert.equal(await strip(p).count(), 1, 'a informação continua no topo mesmo com dispensa antiga');
  await ctx.close(); }
console.log('1d. dispensa antiga do cartão não impede o pop-up OK');

// 1e. ?instalar reabre o pop-up mesmo depois de dispensado e de já ter aberto
{ const { ctx, p } = await open(IPHONE, true, false);
  await p.addInitScript(() => { if (!sessionStorage.getItem('fz_x')) { sessionStorage.setItem('fz_x', '1'); localStorage.setItem('fz_install_dismissed_v1', String(Date.now())); localStorage.setItem('fz_install_intro_v1', '1'); } });
  await p.goto(BASE + '/entrar'); await p.waitForTimeout(1000);
  assert.equal(await p.locator('[role=dialog]').count(), 0, 'sem o parâmetro: nada');
  await p.goto(BASE + '/entrar?instalar=1');
  await p.locator('[role=dialog][aria-labelledby=install-intro-title]').waitFor();
  await ctx.close(); }
console.log('1e. ?instalar reabre o pop-up OK');

// 2. iPhone: convite com passo a passo do Compartilhar
{ const { ctx, p } = await open(IPHONE);
  await p.goto(BASE + '/entrar'); await card(p).waitFor();
  assert.equal(await p.locator('text=Como adicionar').count(), 0, 'sem botão intermediário');
  await p.click('button:has-text("Adicionar à tela inicial")'); // um toque abre o guia
  const dlg = p.locator('[role=dialog]'); await dlg.waitFor();
  await p.waitForSelector('[role=dialog] >> text=Adicionar à Tela de Início');
  await p.screenshot({ path: 'inst-ios.png' });
  assert.ok(await dlg.locator('text=Compartilhar').count());
  await p.click('[role=dialog] >> text=Entendi'); assert.equal(await dlg.count(), 0);
  assert.equal(await card(p).count(), 1, '"Entendi" fecha só o guia; o cartão continua');
  await ctx.close(); }
console.log('2. iPhone: passo a passo do Compartilhar OK');

// 3. Android: usa o instalador do sistema (beforeinstallprompt)
{ const { ctx, p } = await open(ANDROID);
  await p.goto(BASE + '/entrar'); await card(p).waitFor();
  await p.evaluate(() => {
    window.__prompted = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => { window.__prompted++; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await p.waitForSelector('button:has-text("Adicionar à tela inicial")');
  await p.screenshot({ path: 'inst-android.png' });
  await p.click('button:has-text("Adicionar à tela inicial")');
  await p.waitForFunction(() => window.__prompted === 1);
  assert.equal(await p.locator('[role=dialog]').count(), 0, 'com o instalador do sistema não abre guia');
  await p.waitForFunction(() => !document.querySelector('section[aria-label="Adicionar à tela inicial"]'));
  assert.equal(await p.evaluate(() => localStorage.getItem('fz_install_dismissed_v1')), 'installed');
  await p.reload(); await p.waitForTimeout(1000);
  assert.equal(await card(p).count(), 0, 'depois de instalar não volta');
  await ctx.close(); }
console.log('3. Android: abre o instalador do sistema e some depois de instalar OK');

// 4. Android sem o evento: mostra o menu ⋮; "Agora não" comprime
{ const { ctx, p } = await open(ANDROID);
  await p.goto(BASE + '/entrar'); await card(p).waitFor();
  await p.click('button:has-text("Adicionar à tela inicial")'); await p.waitForSelector('[role=dialog] >> text=Adicionar à tela inicial');
  await p.keyboard.press('Escape'); assert.equal(await p.locator('[role=dialog]').count(), 0);
  await p.click('section[aria-label="Adicionar à tela inicial"] >> text=Agora não');
  assert.equal(await card(p).count(), 0);
  await p.reload(); await p.waitForTimeout(1000);
  assert.equal(await card(p).count(), 0, 'comprimido continua comprimido');
  assert.equal(await strip(p).count(), 1, 'mas a informação não some');
  await ctx.close(); }
console.log('4. Android sem evento: instrução do menu e "Agora não" OK');

// 5. app já instalado (standalone): não aparece
{ const { ctx, p } = await open(ANDROID);
  await p.addInitScript(() => { const m = window.matchMedia.bind(window); window.matchMedia = (q) => (q.includes('standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : m(q)); });
  await p.goto(BASE + '/entrar'); await p.waitForTimeout(1200);
  assert.equal(await card(p).count(), 0); await ctx.close(); }
console.log('5. já instalado (standalone): sem convite OK');

// 6. carteira do cliente (logado) mostra o convite e sem rolagem lateral
{ const { ctx, p } = await open(ANDROID);
  await p.goto(BASE + '/entrar'); await p.fill('#c-email', 'lucas@teste.com'); await p.fill('#c-password', 'senha-cliente-1');
  await p.click('button[type=submit]'); await p.waitForURL('**/carteira**');
  await card(p).waitFor();
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sem rolagem lateral');
  await p.screenshot({ path: 'inst-carteira.png' });
  await ctx.close(); }
console.log('6. carteira mostra o convite, sem rolagem lateral OK');
await b.close();
console.log('ALL OK (instalar app)');
