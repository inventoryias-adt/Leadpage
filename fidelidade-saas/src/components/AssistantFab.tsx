'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

const EXAMPLES = {
  cliente: ['Qual o lugar aberto mais perto de mim?', 'Quantos pontos eu tenho em cada lugar?', 'O que eu já posso resgatar hoje?', 'Quais categorias estão abertas agora?'],
  dono: ['Quantos clientes não voltam há mais de 30 dias?', 'Qual o ticket médio do meu clube de pontos?', 'Quantos agendamentos o Lucas tem esta semana?', 'Quantos resgates tenho para entregar?', 'Me dê o relatório da última semana.'],
} as const;

/**
 * Assistente (em breve): botão no canto da tela que explica que a conversa com o assistente está a caminho.
 * Por enquanto só informa; quando for ativado, é aqui que a conversa abre.
 */
export function AssistantFab({ role }: { role: keyof typeof EXAMPLES }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Na tela do pedido a barra da sacola ocupa esse canto.
  if (/\/pedido(\/|$)/.test(pathname)) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Assistente Fidelize (em breve)"
        data-testid="assistant-fab"
        className="fixed bottom-[6.75rem] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#0F1F3D] text-lima shadow-[0_8px_20px_rgba(15,31,61,.35)] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-500 md:bottom-6 md:right-6"
      >
        <Icon name="spark" size={22} />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-lima" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:items-center md:p-6" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="assistant-title" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-md animate-fade-in overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl md:rounded-[28px]">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0F1F3D] text-lima"><Icon name="spark" size={24} /></span>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Fechar">✕</button>
            </div>
            <p className="mt-3"><span className="chip-lima">Em breve</span></p>
            <h2 id="assistant-title" className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Assistente Fidelize<span className="text-electric-500">.</span></h2>
            <p className="mt-1 text-sm text-slate-600">
              Estamos desenvolvendo um assistente para você conversar, tirar dúvidas e pedir informações, em vez de procurar nas telas.
              {role === 'dono' ? ' Ele também vai preparar os relatórios para você.' : ' Ele vai buscar o que você precisa usando a sua localização, se você permitir.'}
            </p>
            <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">Você vai poder perguntar, por exemplo</p>
            <ul className="space-y-2">
              {EXAMPLES[role].map((q) => (
                <li key={q} className="rounded-2xl bg-[#EAF0FF] px-4 py-2.5 text-sm font-medium text-primary">“{q}”</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">Avisamos aqui no app quando estiver disponível.</p>
            <button type="button" onClick={() => setOpen(false)} className="glass-button-navy mt-4">Entendi</button>
          </div>
        </div>
      )}
    </>
  );
}
