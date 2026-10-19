'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Área que rola de lado (a grade da semana no celular): ao abrir, centra a coluna marcada com `data-today="true"` em vez de começar sempre na segunda. */
export function ScrollToToday({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    const today = el?.querySelector<HTMLElement>('[data-today="true"]');
    if (!el || !today) return;
    el.scrollLeft += today.getBoundingClientRect().left - el.getBoundingClientRect().left - (el.clientWidth - today.offsetWidth) / 2;
  }, []);
  return <div ref={box} className={className}>{children}</div>;
}
