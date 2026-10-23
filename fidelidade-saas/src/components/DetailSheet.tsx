'use client';

import { useEffect, useRef } from 'react';
/** Janela de detalhe do painel: sobe do rodapé no celular e fica centralizada no computador. Esc, fundo ou "Fechar" fecham. */
export function DetailSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" data-testid="detail-sheet">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-slate-900/40" onClick={onClose} tabIndex={-1} />
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[26px] bg-white p-5 shadow-2xl outline-none sm:max-w-lg sm:rounded-[26px] sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-lg font-extrabold leading-tight text-primary">{title}</h3>
          <button type="button" onClick={onClose} className="glass-button-ghost btn-sm shrink-0" data-testid="detail-close">Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Quadro de números do topo da janela. */
export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-extrabold leading-tight text-primary tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
