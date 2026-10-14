'use client';

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';

/** De onde o bloco entra: de cima, de baixo, da esquerda, da direita, crescendo (zoom) ou girando (flip). */
export type RevealFrom = 'top' | 'bottom' | 'left' | 'right' | 'zoom' | 'flip';

/**
 * Faz o bloco entrar na tela quando ele aparece na rolagem (estilos `.rv` em globals.css). Cada bloco escolhe a sua direção,
 * então a página vai variando: uns caem, outros vêm dos lados, outros sobem. Sem JavaScript ou com "reduzir movimento" aparece direto.
 */
export function Reveal({
  from = 'bottom',
  delay = 0,
  as,
  className = '',
  children,
}: {
  from?: RevealFrom;
  /** Atraso em ms, para escalonar itens vizinhos. */
  delay?: number;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  const Tag: ElementType = as ?? 'div';
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.setAttribute('data-in', '');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute('data-in', '');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`rv rv-${from} ${className}`} style={{ '--rv-delay': `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}
