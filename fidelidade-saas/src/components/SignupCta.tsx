'use client';

import type { ReactNode } from 'react';

/** Leva até o cadastro, foca o primeiro campo e faz o cartão e o campo piscarem para o visitante saber por onde começar. */
export function focusSignup() {
  const card = document.getElementById('assinar');
  const input = document.getElementById('name') as HTMLInputElement | null;
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => {
    input?.focus({ preventScroll: true });
    for (const el of [card, input]) el?.classList.remove('pulse-attention');
    void card.offsetWidth; // reinicia a animação se clicar de novo
    for (const el of [card, input]) el?.classList.add('pulse-attention');
    window.setTimeout(() => {
      for (const el of [card, input]) el?.classList.remove('pulse-attention');
    }, 3600);
  }, 450);
}

export function SignupCta({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <a
      href="#assinar"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        focusSignup();
      }}
    >
      {children}
    </a>
  );
}
