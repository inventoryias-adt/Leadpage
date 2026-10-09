/** Detecção para o convite "Adicionar à tela inicial": só celular, e cada sistema instala de um jeito. */
export type InstallPlatform = 'ios' | 'android' | 'other';

export function detectPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS 13+ se identifica como Mac, mas tem tela de toque.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** Navegadores embutidos (Instagram, Facebook, TikTok…) não instalam: é preciso abrir no Safari/Chrome. */
export const isInAppBrowser = (ua: string) => /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Line\/|Snapchat|MicroMessenger|; wv\)/i.test(ua);

export const DISMISS_KEY = 'fz_install_dismissed_v1';
export const DISMISS_DAYS = 14;

/** `stored`: valor do localStorage — "installed" (nunca mais) ou o horário (ms) em que dispensou. */
export function shouldOffer(opts: { platform: InstallPlatform; standalone: boolean; stored: string | null; now: number }): boolean {
  if (opts.platform === 'other' || opts.standalone) return false;
  if (opts.stored === 'installed') return false;
  const at = Number(opts.stored);
  if (opts.stored && Number.isFinite(at) && opts.now - at < DISMISS_DAYS * 86_400_000) return false;
  return true;
}
