'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReviewPrompt } from '@/lib/reviews-db';

const KEY = 'fz_review_dismissed';

function dismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; } catch { return []; }
}

/**
 * "Como foi o atendimento?": aparece sobre as telas do app quando o lugar conclui o atendimento e o cliente ainda não avaliou.
 * Tocar numa estrela já abre a avaliação com essa nota. "Agora não" some com o convite (a avaliação segue em Meus agendamentos por 30 dias).
 */
export function ReviewPopup({ prompt }: { prompt: ReviewPrompt | null }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!!prompt && !dismissed().includes(prompt.bookingId)); }, [prompt]);
  if (!prompt || !open || path.includes('/avaliar')) return null;
  const close = () => {
    try { localStorage.setItem(KEY, JSON.stringify([...dismissed(), prompt.bookingId].slice(-20))); } catch { /* sem armazenamento */ }
    setOpen(false);
  };
  const go = (n: number) => router.push(`/perfil/agendamentos/${prompt.bookingId}/avaliar?nota=${n}`);
  return (
    <aside role="dialog" aria-label="Avaliar atendimento" data-testid="review-popup" className="fixed inset-x-0 bottom-28 z-40 mx-auto w-[calc(100%-2rem)] max-w-sm rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(11,27,58,.28)] md:bottom-6 md:right-6 md:left-auto md:mx-0">
      <p className="font-extrabold text-primary">Como foi o atendimento?</p>
      <p className="text-sm text-slate-600">{prompt.serviceName} · {prompt.placeName}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex" role="group" aria-label="Sua nota">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => go(n)} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`} className="flex h-11 w-10 items-center justify-center text-3xl text-amber-400 transition-transform active:scale-90" data-testid={`popup-star-${n}`}>★</button>
          ))}
        </div>
        <button type="button" onClick={close} className="text-sm font-semibold text-slate-500" data-testid="popup-dismiss">Agora não</button>
      </div>
    </aside>
  );
}
