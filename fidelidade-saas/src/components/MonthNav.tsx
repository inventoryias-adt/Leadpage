import Link from 'next/link';
import type { monthRangeBR } from '@/lib/points';

/** Navegação entre meses (?mes=YYYY-MM). */
export function MonthNav({ range, basePath }: { range: ReturnType<typeof monthRangeBR>; basePath: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={`${basePath}?mes=${range.prev}`} className="glass-chip hover:bg-white" aria-label="Mês anterior">← Anterior</Link>
      <p className="font-semibold capitalize text-primary">{range.label}</p>
      {range.isCurrent ? (
        <span className="glass-chip opacity-40" aria-hidden>Próximo →</span>
      ) : (
        <Link href={`${basePath}?mes=${range.next}`} className="glass-chip hover:bg-white" aria-label="Próximo mês">Próximo →</Link>
      )}
    </div>
  );
}
