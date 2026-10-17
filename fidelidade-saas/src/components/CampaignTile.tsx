import type { ReactNode } from 'react';
import type { ColorInfo } from '@/lib/palette';

/** Cartão de campanha: quadradinho colorido com o número ("2x", "+100"), nome e quando vale. */
export function CampaignTile({ big, title, when, color, live, compact, children }: { big: string; title: string; when?: string; color: ColorInfo; live?: boolean; compact?: boolean; children?: ReactNode }) {
  if (compact) {
    // Versão enxuta para listas: quadradinho pequeno, texto curto e "valendo agora" só como um pontinho verde.
    return (
      <div className="hover-tint flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-center font-extrabold leading-none text-white" style={{ background: color.hex, fontSize: big.length > 4 ? 12 : big.length > 3 ? 14 : 16 }}>
          {big}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight text-slate-800">{title}</p>
          {when && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">{when}</p>}
          {children}
        </div>
        {live && <span className="flex shrink-0 items-center gap-1 self-start text-[11px] font-bold text-emerald-700"><span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />Agora</span>}
      </div>
    );
  }
  return (
    <div className="glass-panel-sm flex items-center gap-3.5 p-3.5">
      <span
        aria-hidden
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-center font-extrabold leading-none text-white"
        style={{ background: color.hex, fontSize: big.length > 4 ? 18 : big.length > 3 ? 22 : 26 }}
      >
        {big}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight text-slate-800">{title}</p>
        {when && <p className="mt-0.5 text-xs leading-snug text-slate-500">{when}</p>}
        {children}
      </div>
      {live && <span className="chip-verde shrink-0 self-start">Valendo agora</span>}
    </div>
  );
}
