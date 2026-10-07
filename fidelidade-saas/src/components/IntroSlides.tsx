'use client';

import { useEffect, useState } from 'react';
import { Illustration } from './Illustrations';

const KEY = 'fz_intro_v1';

const slides = [
  {
    variant: 'qr' as const,
    title: 'Cada compra vira pontos',
    text: 'Depois de pagar, leia o QR Code do caixa. Os pontos entram na sua carteira na hora, sem baixar nenhum aplicativo.',
  },
  {
    variant: 'places' as const,
    title: 'Encontre lugares perto de você',
    text: 'Veja onde você já tem pontos, o que dá para resgatar e os desafios de cada casa.',
  },
  {
    variant: 'gift' as const,
    title: 'Troque por prêmios de verdade',
    text: 'Monte a sua sacola com os prêmios que cabem nos seus pontos e retire no balcão.',
  },
];

/** Apresentação de 3 telas na primeira visita. Pode ser pulada e não volta a aparecer. */
export function IntroSlides() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* sem localStorage: simplesmente não mostra */
    }
  }, []);

  function close() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignora */
    }
    setOpen(false);
  }

  if (!open) return null;
  const last = i === slides.length - 1;
  const s = slides[i];

  return (
    <div role="dialog" aria-modal="true" aria-label="Bem-vindo ao Fidelize" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-4 backdrop-blur-sm sm:items-center">
      <div className="glass-panel animate-fade-in relative w-full max-w-sm p-6 text-center" style={{ background: "rgba(255,255,255,0.97)" }}>
        <button type="button" onClick={close} className="absolute right-4 top-4 text-sm font-semibold text-slate-500 hover:text-primary">
          Pular
        </button>
        <div className="mt-4 flex justify-center">
          <Illustration variant={s.variant} size={200} />
        </div>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">{s.title}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-600">{s.text}</p>

        <div className="my-5 flex justify-center gap-1.5" aria-hidden>
          {slides.map((_, n) => (
            <span key={n} className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-electric-600' : 'w-2 bg-slate-300'}`} />
          ))}
        </div>

        <button type="button" onClick={() => (last ? close() : setI(i + 1))} className="glass-button">
          {last ? 'Começar' : 'Próximo'}
        </button>
      </div>
    </div>
  );
}
