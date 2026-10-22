import { formatAvg, type RatingSummary } from '@/lib/reviews';

/** Estrelas só para mostrar (nota inteira ou média). */
export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span role="img" aria-label={label ?? `${formatAvg(value)} de 5 estrelas`} className="inline-flex" style={{ fontSize: size, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} aria-hidden="true" className={i <= full ? 'text-amber-400' : 'text-slate-300'}>★</span>)}
    </span>
  );
}

/** "★ 4,8 (23)" quando o lugar já tem avaliações suficientes; nada antes disso. */
export function RatingBadge({ summary, className = '' }: { summary: RatingSummary | undefined; className?: string }) {
  if (!summary?.ranked || summary.avg == null) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold text-slate-700 ${className}`} data-testid="rating-badge" aria-label={`Nota ${formatAvg(summary.avg)} de 5, ${summary.count} avaliações`}>
      <span aria-hidden="true" className="text-amber-400">★</span>
      {formatAvg(summary.avg)}
      <span className="font-medium text-slate-500">({summary.count})</span>
    </span>
  );
}
