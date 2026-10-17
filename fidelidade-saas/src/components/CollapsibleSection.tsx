'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icons';

/**
 * Seção que abre e fecha ao toque (campanhas, desafios, ações para ganhar pontos): fechada, mostra só o título e um resumo;
 * a setinha pisca de leve até a pessoa abrir uma vez, para ela saber que dá para tocar. O que ela deixa aberto fica lembrado
 * neste aparelho (`fz_sec_<id>`) e um link com `#id` na URL abre a seção sozinho.
 */
export function CollapsibleSection({ id, title, summary, icon, defaultOpen = false, children }: { id: string; title: string; summary?: string; icon?: IconName; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const [seen, setSeen] = useState(false); // já abriu/fechou alguma vez? Até lá a setinha pisca
  const panel = useId();
  const key = `fz_sec_${id}`;

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v === '1') setOpen(true);
      else if (v === '0') setOpen(false);
      setSeen(v !== null);
    } catch { /* sem armazenamento: segue o padrão */ }
    // Um link para #acoes, #desafios… (ex.: "Quero participar" numa campanha) abre a seção e leva até ela.
    const goto = () => {
      if (window.location.hash !== `#${id}`) return;
      setOpen(true);
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    };
    goto();
    window.addEventListener('hashchange', goto);
    return () => window.removeEventListener('hashchange', goto);
  }, [id, key]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    setSeen(true);
    try { localStorage.setItem(key, next ? '1' : '0'); } catch { /* ignora */ }
  };

  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="m-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panel}
          className="hover-flip glass-panel-sm flex w-full items-center gap-3 !p-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
        >
          {icon && <span className="icon-tile"><Icon name={icon} /></span>}
          <span className="min-w-0 flex-1">
            <span className="hf-t block font-bold text-slate-800">{title}</span>
            {summary && <span className="hf-s block truncate text-xs font-medium text-slate-500">{summary}</span>}
          </span>
          <span aria-hidden className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-electric-600">
            {!open && !seen && <span className="absolute inset-0 animate-ping rounded-full bg-electric-500/30" />}
            <Icon name="down" size={18} className={`relative transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
      </h2>
      <div id={panel} className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
