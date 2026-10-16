import { formatBRL } from '@/lib/points';
import { Icon } from './Icons';

/**
 * Cupom do prêmio: bilhete azul-marinho com o prêmio em cima, picote no meio e o código grande embaixo para mostrar no balcão.
 * `compact` serve para listas; sem ele é a tela cheia do cupom.
 */
export function VoucherTicket({
  code,
  rewardName,
  placeName,
  cashCents = 0,
  compact = false,
  used = false,
}: {
  code: string;
  rewardName: string;
  placeName: string;
  cashCents?: number;
  compact?: boolean;
  used?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-[24px] bg-[#0F1F3D] text-white shadow-[0_10px_28px_rgba(15,31,61,.28)]" aria-label={`Cupom: ${rewardName} em ${placeName}`}>
      <div className={`flex items-center gap-3 ${compact ? 'p-4' : 'p-5'}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-lima text-primary ${compact ? 'h-11 w-11' : 'h-14 w-14'}`}><Icon name="gift" size={compact ? 22 : 28} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">{placeName}</p>
          <h3 className={`font-extrabold leading-snug ${compact ? 'truncate text-base' : 'text-xl'}`}>{rewardName}</h3>
          {cashCents > 0 && <p className="text-xs text-white/70">Pague {formatBRL(cashCents)} no balcão ao retirar</p>}
        </div>
        {used && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">Entregue</span>}
      </div>
      <div className="relative" aria-hidden>
        <div className="border-t-2 border-dashed border-white/25" />
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[#F7F8FA]" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[#F7F8FA]" />
      </div>
      <div className={`text-center ${compact ? 'px-4 pb-4 pt-3' : 'px-5 pb-6 pt-4'}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Seu código</p>
        <p className={`mx-auto mt-1 w-fit rounded-2xl border-2 border-dashed border-lima/70 px-5 py-1.5 font-mono font-bold tracking-[0.25em] text-lima ${compact ? 'text-2xl' : 'text-4xl'}`} data-testid="voucher-code">{code}</p>
        {!compact && <p className="mt-3 text-sm text-white/80">Mostre este código no balcão para retirar.</p>}
      </div>
    </article>
  );
}
