'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from './Brand';

/**
 * Abertura do app: fundo marinho com um degradê leve, o símbolo inteiro surge com um fade, cresce devagar (zoom suave no logo todo,
 * sem foco na moeda) e o fundo se dissolve para mostrar o app (animação em globals.css, ~2,6 s). Toca uma vez por sessão, só no app (não na landing nem nos textos legais)
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
    const t = window.setTimeout(() => setDone(true), 2700);
    return () => window.clearTimeout(t);
  }, []);
  if (done) return null;
  return (
    <div className="splash" aria-hidden>
      <div className="splash-zoom">
        <LogoMark size={704} />
      </div>
    </div>
  );
}
