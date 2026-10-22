// Regras no celular: o passo atual fica marinho/negrito e aparece na faixa rolável (sem precisar rolar).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1','1'); localStorage.setItem('fz_install_intro_v1','1'); try{sessionStorage.setItem('fz_splash','1')}catch{} });
const p = await ctx.newPage();
await p.goto(BASE+'/login'); await p.fill('#email','ze@burger.com'); await p.fill('#password','senha-segura-1'); await p.click('button[type=submit]'); await p.waitForURL('**/dashboard');
for (const et of ['negocio','premios','conta']) {
  await p.goto(BASE+'/dashboard/configuracoes?etapa='+et); await p.waitForSelector('nav.chip-row[aria-label="Seções"] [aria-current]');
  await p.waitForTimeout(500);
  const info = await p.evaluate(() => { const a=document.querySelector('nav.chip-row[aria-label="Seções"] [aria-current]'); const n=a.parentElement; const cs=getComputedStyle(a); const ar=a.getBoundingClientRect(), nr=n.getBoundingClientRect(); return { bg: cs.backgroundColor, color: cs.color, weight: cs.fontWeight, visible: ar.left>=nr.left-1 && ar.right<=nr.right+1, text:a.textContent }; });
  console.log(et, JSON.stringify(info));
  assert.equal(info.bg, 'rgb(15, 31, 61)'); assert.ok(info.visible, 'ativo visível'); assert.ok(Number(info.weight)>=600);
  }
await b.close(); console.log('Passos de Regras no celular: item ativo marinho, em negrito e visível na faixa OK');
