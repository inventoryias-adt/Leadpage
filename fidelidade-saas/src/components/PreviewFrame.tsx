import type { ReactNode } from 'react';
import { Icon } from './Icons';

/** Moldura "assim o cliente vê no app": mostra, ao vivo, como o que o dono está preenchendo vai aparecer no celular do cliente. */
export function PreviewFrame({ title = 'Assim o cliente vê no app', where, children }: { title?: string; where: string; children: ReactNode }) {
  return (
    <aside data-testid="client-preview" aria-label={title} className="rounded-2xl border border-[#d9e1f2] bg-[#f3f6fd] p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0f1f3d] text-[#c6f432]"><Icon name="phone" size={14} /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-primary">{title}</p>
          <p className="text-xs text-slate-500">Aparece em: {where}</p>
        </div>
      </div>
      <div className="pointer-events-none select-none">{children}</div>
    </aside>
  );
}
