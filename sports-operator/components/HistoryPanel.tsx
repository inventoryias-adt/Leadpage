'use client';

import type { EntryRecord } from '../lib/types';
import type { BankrollStats } from '../lib/stats';

function money(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

const statusLabel: Record<EntryRecord['status'], string> = {
  pending: 'PENDENTE',
  win: 'WIN',
  loss: 'LOSS',
  void: 'VOID'
};
const statusColor: Record<EntryRecord['status'], string> = {
  pending: 'text-muted',
  win: 'text-accent',
  loss: 'text-danger',
  void: 'text-warn'
};

export default function HistoryPanel({
  entries,
  stats,
  onSettle
}: {
  entries: EntryRecord[];
  stats: BankrollStats;
  onSettle: (id: string, status: 'win' | 'loss' | 'void') => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Lucro acumulado" value={money(stats.accumulatedProfit)} good />
        <Stat label="Prejuízo acumulado" value={money(stats.accumulatedLoss)} bad />
        <Stat label="Resultado líquido" value={money(stats.netResult)} good={stats.netResult >= 0} bad={stats.netResult < 0} />
        <Stat label="ROI" value={pct(stats.roi)} good={stats.roi >= 0} bad={stats.roi < 0} />
        <Stat label="Yield" value={pct(stats.yield)} />
        <Stat label="Taxa de acerto" value={pct(stats.hitRate)} />
        <Stat label="Drawdown máximo" value={money(stats.maxDrawdown)} bad />
        <Stat label="Entradas" value={String(stats.totalEntries)} />
      </div>

      <div className="flex justify-end">
        <a
          href="/api/export"
          className="text-xs px-3 py-1.5 rounded border border-border hover:bg-panel2 transition"
        >
          EXPORTAR HISTÓRICO (CSV)
        </a>
      </div>

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-panel2 text-muted">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-right p-2">Odd</th>
              <th className="text-right p-2">Stake</th>
              <th className="text-right p-2">Lucro/Prej.</th>
              <th className="text-center p-2">Status</th>
              <th className="text-center p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-2 whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString('pt-BR')}</td>
                <td className="p-2">{e.type}</td>
                <td className="p-2 max-w-xs truncate" title={e.description}>{e.description}</td>
                <td className="p-2 text-right">{e.odd.toFixed(2)}</td>
                <td className="p-2 text-right">{money(e.stake)}</td>
                <td className={`p-2 text-right ${e.profitLoss && e.profitLoss > 0 ? 'text-accent' : e.profitLoss && e.profitLoss < 0 ? 'text-danger' : ''}`}>
                  {e.profitLoss != null ? money(e.profitLoss) : '—'}
                </td>
                <td className={`p-2 text-center font-semibold ${statusColor[e.status]}`}>{statusLabel[e.status]}</td>
                <td className="p-2">
                  {e.status === 'pending' ? (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => onSettle(e.id, 'win')} className="text-xs px-2 py-1 rounded bg-accent/20 text-accent border border-accent/40">WIN</button>
                      <button onClick={() => onSettle(e.id, 'loss')} className="text-xs px-2 py-1 rounded bg-danger/20 text-danger border border-danger/40">LOSS</button>
                      <button onClick={() => onSettle(e.id, 'void')} className="text-xs px-2 py-1 rounded bg-warn/20 text-warn border border-warn/40">VOID</button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted block text-center">—</span>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-muted">
                  Nenhuma entrada registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  const color = good ? 'text-accent' : bad ? 'text-danger' : 'text-slate-100';
  return (
    <div className="bg-panel border border-border rounded-lg p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
