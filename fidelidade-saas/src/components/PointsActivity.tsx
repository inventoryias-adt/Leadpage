'use client';

import { useState } from 'react';
import { AreaChart, type AreaPoint } from './AreaChart';
import { PERIODS, PERIOD_LABEL, type Activity, type Period } from '@/lib/activity';
import { formatPoints } from '@/lib/points';

/** Gráfico de área: pontos ganhos acumulados no período (componente padrão do Fidelize). */
function PointsChart({ activity, label }: { activity: Activity; label: string }) {
  const points: AreaPoint[] = activity.slots.map((s) => ({
    label: s.label,
    value: s.total,
    active: s.earned > 0 || s.redeemed > 0,
    title: s.label,
    strong: `+${formatPoints(s.earned)} pts`,
    lines: [`${s.redeemed > 0 ? `−${formatPoints(s.redeemed)} pts usados · ` : ''}acumulado ${formatPoints(s.total)}`],
  }));
  return <AreaChart points={points} label={label} empty="Nenhuma movimentação neste período" />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 sm:border-l sm:border-[#E5E7EB] sm:px-4 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-primary sm:text-2xl">{value}</p>
    </div>
  );
}

export function PointsActivity({ data, balance, places }: { data: Record<Period, Activity>; balance: number; places: number }) {
  const [period, setPeriod] = useState<Period>('semana');
  const a = data[period];
  return (
    <div className="glass-panel space-y-4 p-4 sm:p-6">
      <div>
        <p className="text-sm text-slate-500">Pontos ganhos</p>
        <p className="text-4xl font-semibold tracking-tight text-primary" aria-live="polite">{formatPoints(a.earned)}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Período do gráfico">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors ${period === p ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      <PointsChart activity={a} label={`Pontos ganhos acumulados: ${PERIOD_LABEL[period]}`} />
      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-[#E5E7EB] p-4 sm:flex sm:gap-0">
        <Stat label="Pontuações" value={formatPoints(a.earnCount)} />
        <Stat label="Resgates" value={formatPoints(a.redeemCount)} />
        <Stat label="Saldo atual" value={formatPoints(balance)} />
        <Stat label={places === 1 ? 'Lugar' : 'Lugares'} value={formatPoints(places)} />
      </div>
    </div>
  );
}
