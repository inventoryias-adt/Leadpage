'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FGlyph, BRAND_OURO } from './Brand';
import { Cerveja, Cruz, Haltere, Hamburguer, Pata, Tesoura, Xicara } from './BrandItems';

/** As letras de "idelize" e o item em que cada uma vira (larguras em em: letra e item). */
const SLOTS: { ch: string; wl: number; wi: number; icon: ReactNode }[] = [
  { ch: 'i', wl: 0.27, wi: 0.7, icon: <Tesoura /> },
  { ch: 'd', wl: 0.6, wi: 0.7, icon: <Xicara /> },
  { ch: 'e', wl: 0.58, wi: 0.78, icon: <Cerveja /> },
  { ch: 'l', wl: 0.26, wi: 0.7, icon: <Pata /> },
  { ch: 'i', wl: 0.27, wi: 0.64, icon: <Haltere /> },
  { ch: 'z', wl: 0.5, wi: 0.7, icon: <Cruz /> },
  { ch: 'e', wl: 0.58, wi: 0.7, icon: <Hamburguer /> },
];

/**
 * Abertura do app (~6,5 s): fundo verde-floresta, tudo numa cor só (sem degradê).
 * O F dourado aparece sozinho no meio, vai para o lado e as outras letras saem de dentro dele; cada letra vira um item de um tipo de lugar
 * que o Fidelize atende (em contorno fino) e, na volta, tudo recolhe para dentro do F, que já vai para o meio enquanto isso.
 * Então quatro cantos de escaneamento se fecham em volta dele e o nome "FIDELIZE" aparece embaixo; por fim o fundo se dissolve e mostra o app (animação em globals.css).
 * Não bloqueia cliques. Toca uma vez por sessão, só no app (não na landing nem nos textos legais) e nunca com "reduzir movimento" ou navegador automatizado;
 * `?splash=1` força (para testar). A decisão de pular é tomada antes da primeira pintura por SPLASH_GATE (no <head>), que marca <html data-splash="off">.
 */
export function Splash() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (document.documentElement.getAttribute('data-splash') === 'off') {
      setDone(true);
      return;
    }
    try { sessionStorage.setItem('fz_splash', '1'); } catch { /* sem armazenamento: toca de novo na próxima abertura */ }
    const t = window.setTimeout(() => setDone(true), 6900);
    return () => window.clearTimeout(t);
  }, []);
  if (done) return null;
  return (
    <div className="splash" aria-hidden>
      <div className="sp-lockup">
        <svg className="sp-f" viewBox="17 11 32 42">
          <FGlyph fill={BRAND_OURO} topClass="sp-top" midClass="sp-mid" />
        </svg>
        <span className="sp-letters">
          {SLOTS.map((s, i) => (
            <span key={i} className="sp-slot" style={{ '--i': i, '--wl': `${s.wl}em`, '--wi': `${s.wi}em` } as CSSProperties}>
              <span className="sp-ch">{s.ch}</span>
              <svg className="sp-ic" viewBox="0 0 40 52">{s.icon}</svg>
            </span>
          ))}
        </span>
      </div>
      <svg className="sp-frame" viewBox="0 0 100 100">
        <path d="M4 22V4H22M78 4H96V22M96 78V96H78M22 96H4V78" fill="none" stroke={BRAND_OURO} strokeWidth="2.4" />
      </svg>
      <p className="sp-name">FIDELIZE</p>
    </div>
  );
}
