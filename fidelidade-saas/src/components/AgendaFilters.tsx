'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

type Option = { value: string; label: string; href: string };

/**
 * Filtros da agenda em menus suspensos (em vez de uma fileira de botões): "Ver" (dia, semana, mês) e "Atendente".
 * Cada opção já traz o endereço da tela com aquele filtro; escolher navega para ele.
 */
export function AgendaFilters({ periods, period, staff, staffId }: { periods: Option[]; period: string; staff: Option[]; staffId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (options: Option[]) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = options.find((o) => o.value === e.target.value);
    if (next) start(() => router.push(next.href));
  };
  return (
    <div className={`grid gap-3 ${staff.length > 0 ? 'grid-cols-2' : 'grid-cols-1 sm:max-w-xs'} sm:max-w-lg`} aria-busy={pending} data-testid="agenda-filtros">
      <div>
        <label htmlFor="ag-ver" className="glass-label">Ver</label>
        <select id="ag-ver" aria-label="Período" value={period} onChange={go(periods)} className="glass-input">
          {periods.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {staff.length > 0 && (
        <div>
          <label htmlFor="ag-prof" className="glass-label">Atendente</label>
          <select id="ag-prof" aria-label="Profissional" value={staffId} onChange={go(staff)} className="glass-input">
            {staff.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
