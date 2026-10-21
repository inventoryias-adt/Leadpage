'use client';

import { useEffect, useRef } from 'react';

// Dentro de uma faixa rolável (chip-row): centraliza o item marcado com
// aria-current, para que o passo atual apareça sem o usuário precisar rolar.
export function ScrollActiveIntoView() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const row = ref.current?.parentElement;
    const active = row?.querySelector<HTMLElement>('[aria-current]');
    if (!row || !active) return;
    const r = row.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    row.scrollLeft += a.left - r.left - (r.width - a.width) / 2;
  }, []);
  return <span ref={ref} hidden />;
}
