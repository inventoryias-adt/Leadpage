import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPlatform, isInAppBrowser, shouldOffer } from './install-app';

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

test('oferece só no celular, fora do app instalado e respeitando "Agora não" por 14 dias', () => {
  const now = Date.UTC(2026, 9, 9);
  const base = { platform: 'android' as const, standalone: false, stored: null, now };
  assert.equal(shouldOffer(base), true);
  assert.equal(shouldOffer({ ...base, platform: 'other' }), false);
  assert.equal(shouldOffer({ ...base, standalone: true }), false);
  assert.equal(shouldOffer({ ...base, stored: 'installed' }), false);
  assert.equal(shouldOffer({ ...base, stored: String(now - 3 * 86_400_000) }), false);
  assert.equal(shouldOffer({ ...base, stored: String(now - 15 * 86_400_000) }), true);
  assert.equal(shouldOffer({ ...base, stored: 'lixo' }), true);
});
