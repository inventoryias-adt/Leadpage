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
/** O pop-up central abre uma vez só por aparelho; depois fica apenas o cartão no topo. */
export const INTRO_KEY = 'fz_install_intro_v1';
export const DISMISS_DAYS = 14;

/** `stored`: valor do localStorage — "installed" (nunca mais) ou o horário (ms) em que dispensou. */
export function shouldOffer(opts: { platform: InstallPlatform; standalone: boolean; stored: string | null; now: number }): boolean {
  if (opts.platform === 'other' || opts.standalone) return false;
  if (opts.stored === 'installed') return false;
  const at = Number(opts.stored);
  if (opts.stored && Number.isFinite(at) && opts.now - at < DISMISS_DAYS * 86_400_000) return false;
  return true;
}

/**
 * Pop-up da primeira visita: só depende de ser celular, não estar instalado e nunca ter aberto.
 * Ignora o "Agora não" antigo do cartão (que esconde o cartão por 14 dias), senão quem já recusou o cartão nunca veria o pop-up.
 */
export function shouldShowIntro(opts: { platform: InstallPlatform; standalone: boolean; stored: string | null; introSeen: boolean }): boolean {
  if (opts.platform === 'other' || opts.standalone || opts.introSeen) return false;
  return opts.stored !== 'installed';
}
