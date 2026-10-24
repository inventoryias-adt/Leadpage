'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { markNoticesRead } from '@/app/actions/avisos';
import { Icon } from './Icons';

/**
 * Um dia da lista de avisos, fechado por padrão: mostra a data, quantos avisos tem e quantos são novos; ao tocar, abre a lista do dia.
 * Os avisos novos viram "lidos" assim que o dia é aberto, para ninguém perder um aviso sem ver.
 */
export function NoticeDay({ label, count, unreadIds, children }: { label: string; count: number; unreadIds: string[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const key = unreadIds.join(',');

  // Abriu o dia, viu: os novos viram "lidos" na hora (a bolinha some já; o servidor confirma em seguida e, se falhar, a bolinha volta).
  useEffect(() => {
    if (!open || !key) return;
    setSeen(true);
    let cancelled = false;
    void markNoticesRead(key.split(',')).catch(() => { if (!cancelled) setSeen(false); });
    return () => { cancelled = true; };
  }, [open, key]);

  const fresh = seen ? 0 : unreadIds.length;
  return (
    <section aria-label={label} data-testid="notice-day">
      <h2 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2.5 !rounded-2xl border border-slate-200 !bg-white px-3.5 py-2.5 text-left !shadow-none transition-colors hover:!bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
        >
          <span className="text-sm font-bold uppercase tracking-wide text-slate-700">{label}</span>
          <span className="text-xs font-semibold normal-case tracking-normal text-slate-400">· {count} {count === 1 ? 'aviso' : 'avisos'}</span>
          {fresh > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={`${fresh} ${fresh === 1 ? 'novo' : 'novos'}`}>{fresh} {fresh === 1 ? 'novo' : 'novos'}</span>}
          <Icon name="down" size={16} className={`ml-auto shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      {open && <div className="mt-1.5 animate-fade-in">{children}</div>}
    </section>
  );
}
