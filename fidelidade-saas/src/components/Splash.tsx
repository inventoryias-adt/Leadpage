'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from './Brand';

/**
 * Abertura do app: fundo marinho, o símbolo aparece, a câmera dá zoom na moeda até a tela ficar azul e tudo se apaga
 * para mostrar o app (animação em globals.css, ~3 s: o símbolo fica sempre no meio da tela e a moeda termina no centro). Toca uma vez por sessão, só no app (não na landing nem nos textos legais)
 * e nunca com "reduzir movimento" ou navegador automatizado; `?splash=1` força (para testar).
 * A decisão de pular é tomada antes da primeira pintura por SPLASH_GATE (no <head>), que marca <html data-splash="off">.
 */
export function Splash() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (document.documentElement.getAttribute('data-splash') === 'off') {
      setDone(true);
      return;
    }
    try { sessionStorage.setItem('fz_splash', '1'); } catch { /* sem armazenamento: toca de novo na próxima abertura */ }
    const t = window.setTimeout(() => setDone(true), 3100);
    return () => window.clearTimeout(t);
  }, []);
  if (done) return null;
  return (
    <div className="splash" aria-hidden>
      <div className="splash-move">
        <div className="splash-zoom">
          <LogoMark size={704} />
        </div>
      </div>
    </div>
  );
}
