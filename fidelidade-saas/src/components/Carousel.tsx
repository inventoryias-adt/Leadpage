'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icons';

/**
 * Carrossel horizontal que deixa claro que dá para arrastar: o cartão seguinte aparece cortado na borda,
 * uma sombra esmaece o lado com mais conteúdo, uma setinha redonda convida a tocar, uma barrinha mostra
 * em que ponto da fila você está e, até a primeira rolagem, um aviso "Deslize para ver mais".
 * No computador também rola com o trackpad ou Shift + roda do mouse. Os filhos devem ser <li>.
 */
export function Carousel({ children, label, className = '', hint = true }: { children: ReactNode; label: string; className?: string; hint?: boolean }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const [bar, setBar] = useState({ width: 100, left: 0 });
  const [moved, setMoved] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 });
    const width = el.scrollWidth > 0 ? Math.max(12, Math.min(100, (el.clientWidth / el.scrollWidth) * 100)) : 100;
    setBar({ width, left: max > 0 ? (el.scrollLeft / max) * (100 - width) : 0 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const onScroll = () => {
      update();
      if (el.scrollLeft > 8) setMoved(true);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [update, children]);

  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  const scrollable = !(edge.start && edge.end);
  const arrow = 'absolute top-[calc(50%-0.75rem)] z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-colors hover:bg-slate-50';

  return (
    <div className="relative" role="region" aria-label={label}>
      <ul
        ref={ref}
        className={`no-scrollbar -mx-4 flex scroll-pl-4 snap-x snap-proximity gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-pl-6 sm:px-6 md:mx-0 md:scroll-pl-0 md:px-0 ${className}`}
      >
        {children}
      </ul>

      {!edge.end && <span aria-hidden className="pointer-events-none absolute -right-4 bottom-2 top-0 z-[5] w-12 bg-gradient-to-l from-[#F7F8FA] to-transparent sm:-right-6 md:right-0" />}
      {!edge.start && <span aria-hidden className="pointer-events-none absolute -left-4 bottom-2 top-0 z-[5] w-8 bg-gradient-to-r from-[#F7F8FA] to-transparent sm:-left-6 md:left-0" />}

      {!edge.start && (
        <button type="button" onClick={() => go(-1)} aria-label={`${label}: anteriores`} className={`${arrow} left-1 md:-left-3`}>
          <Icon name="chevron" size={18} className="rotate-180" />
        </button>
      )}
      {!edge.end && (
        <button type="button" onClick={() => go(1)} aria-label={`${label}: próximos`} className={`${arrow} right-1 md:-right-3 ${moved ? '' : 'animate-nudge'}`}>
          <Icon name="chevron" size={18} />
        </button>
      )}

      {scrollable && (
        <div className="mt-1 flex items-center gap-3" aria-hidden>
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
            <span className="absolute inset-y-0 rounded-full bg-electric-500 transition-[left] duration-100" style={{ width: `${bar.width}%`, left: `${bar.left}%` }} />
          </div>
          {hint && !moved && <span className="shrink-0 text-[11px] font-semibold text-slate-500">Deslize para ver mais</span>}
        </div>
      )}
    </div>
  );
}
