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
/** Estado do cartão: "Agora não" só o comprime numa tira fina no topo (nunca o esconde); um toque na tira o abre de novo. */
export const COLLAPSE_KEY = 'fz_install_collapsed_v1';

/** `stored`: "installed" quando o app já foi instalado neste aparelho (valores antigos, como horários, são ignorados). */
export function shouldOffer(opts: { platform: InstallPlatform; standalone: boolean; stored: string | null }): boolean {
  if (opts.platform === 'other' || opts.standalone) return false;
  return opts.stored !== 'installed';
}

/** Pop-up da primeira visita: celular, app não instalado e nunca aberto neste aparelho. */
export function shouldShowIntro(opts: { platform: InstallPlatform; standalone: boolean; stored: string | null; introSeen: boolean }): boolean {
  return shouldOffer(opts) && !opts.introSeen;
}
