import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPlatform, isInAppBrowser, shouldOffer, shouldShowIntro } from './install-app';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

test('identifica o sistema do celular (e ignora computador)', () => {
  assert.equal(detectPlatform(IPHONE), 'ios');
  assert.equal(detectPlatform(ANDROID), 'android');
  assert.equal(detectPlatform(MAC, 5), 'ios', 'iPad se passando por Mac');
  assert.equal(detectPlatform(MAC, 0), 'other');
  assert.equal(detectPlatform(WINDOWS), 'other');
});

test('reconhece navegador embutido (não instala)', () => {
  assert.ok(isInAppBrowser('Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0'));
  assert.ok(isInAppBrowser('Mozilla/5.0 (Linux; Android 14; wv) FBAV/450.0'));
  assert.equal(isInAppBrowser(IPHONE), false);
  assert.equal(isInAppBrowser(ANDROID), false);
});

test('oferece só no celular e fora do app instalado; "Agora não" nunca esconde', () => {
  const base = { platform: 'android' as const, standalone: false, stored: null };
  assert.equal(shouldOffer(base), true);
  assert.equal(shouldOffer({ ...base, platform: 'other' }), false);
  assert.equal(shouldOffer({ ...base, standalone: true }), false);
  assert.equal(shouldOffer({ ...base, stored: 'installed' }), false);
  assert.equal(shouldOffer({ ...base, stored: String(Date.now()) }), true, 'valor antigo de "dispensado" é ignorado: a informação fica fixa');
});

test('pop-up da primeira visita: só celular, só uma vez e não no app instalado', () => {
  const base = { platform: 'ios' as const, standalone: false, stored: String(Date.now()), introSeen: false };
  assert.equal(shouldShowIntro(base), true, 'valor antigo de dispensa não impede o pop-up');
  assert.equal(shouldShowIntro({ ...base, introSeen: true }), false, 'só abre uma vez');
  assert.equal(shouldShowIntro({ ...base, stored: 'installed' }), false);
  assert.equal(shouldShowIntro({ ...base, standalone: true }), false);
  assert.equal(shouldShowIntro({ ...base, platform: 'other' }), false);
});
