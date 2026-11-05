'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FGlyph, FGradient, BRAND_BLUE, BRAND_GREEN } from './Brand';
import { Acai, Batom, Cupcake, Pizza, Sorvete, Tesoura, Xicara } from './BrandItems';

const G = 'sp-g';
const GI = 'sp-gi';
const BG = '#0b1b3a';

/** As letras de "idelize" e o item em que cada uma vira (larguras em em: letra e item). */
const SLOTS: { ch: string; wl: number; wi: number; icon: ReactNode }[] = [
  { ch: 'i', wl: 0.27, wi: 0.7, icon: <Tesoura g={GI} bg={BG} /> },
  { ch: 'd', wl: 0.6, wi: 0.7, icon: <Xicara g={GI} bg={BG} /> },
  { ch: 'e', wl: 0.58, wi: 0.78, icon: <Cupcake g={GI} bg={BG} /> },
  { ch: 'l', wl: 0.26, wi: 0.62, icon: <Batom g={GI} bg={BG} /> },
  { ch: 'i', wl: 0.27, wi: 0.7, icon: <Sorvete g={GI} bg={BG} /> },
  { ch: 'z', wl: 0.5, wi: 0.72, icon: <Pizza g={GI} bg={BG} /> },
  { ch: 'e', wl: 0.58, wi: 0.7, icon: <Acai g={GI} bg={BG} /> },
];

/**
 * Abertura do app (~6 s): fundo marinho; o F com degradê aparece sozinho no meio, vai para o lado e as outras letras saem de dentro dele;
 * cada letra vira um item dos lugares que o Fidelize atende (tesoura, xícara, cupcake, batom, sorvete, pizza e açaí) e volta a ser letra,
 * formando "Fidelize"; então o fundo se dissolve para mostrar o app (animação em globals.css). Um toque na tela pula.
 * Toca uma vez por sessão, só no app (não na landing nem nos textos legais) e nunca com "reduzir movimento" ou navegador automatizado;
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
    const t = window.setTimeout(() => setDone(true), 6300);
    return () => window.clearTimeout(t);
  }, []);
  if (done) return null;
  return (
    <div className="splash" aria-hidden onClick={() => setDone(true)}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <FGradient id={G} />
          <linearGradient id={GI} gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="38" y2="50">
            <stop offset="0" stopColor={BRAND_BLUE} />
            <stop offset="1" stopColor={BRAND_GREEN} />
          </linearGradient>
        </defs>
      </svg>
      <div className="sp-lockup">
        <svg className="sp-f" viewBox="17 11 32 42">
          <FGlyph fill={`url(#${G})`} topClass="sp-top" midClass="sp-mid" />
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
    </div>
  );
}
