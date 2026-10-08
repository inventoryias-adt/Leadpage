'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icons';

/**
 * Carrossel horizontal. No celular desliza com o dedo (sem barra de rolagem);
 * no computador ganha setas nas pontas e também rola com o trackpad ou Shift + roda do mouse.
 * Os filhos devem ser <li>.
 */
export function Carousel({ children, label, className = '' }: { children: ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update, children]);

  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  const arrow = 'absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 md:flex';

  return (
    <div className="relative" role="region" aria-label={label}>
      <ul
        ref={ref}
        className={`no-scrollbar -mx-4 flex snap-x snap-proximity gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 ${className}`}
      >
        {children}
      </ul>
      {!edge.start && (
        <button type="button" onClick={() => go(-1)} aria-label={`${label}: anteriores`} className={`${arrow} -left-3`}>
          <Icon name="chevron" size={18} className="rotate-180" />
        </button>
      )}
      {!edge.end && (
        <button type="button" onClick={() => go(1)} aria-label={`${label}: próximos`} className={`${arrow} -right-3`}>
          <Icon name="chevron" size={18} />
        </button>
      )}
    </div>
  );
}
