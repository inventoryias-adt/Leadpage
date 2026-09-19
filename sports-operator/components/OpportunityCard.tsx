'use client';

import type { Opportunity } from '../lib/types';

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function money(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const typeLabel: Record<Opportunity['type'], string> = {
  simple: 'SIMPLES',
  multiple: 'MÚLTIPLA',
  no_bet: 'NO BET'
};

const confidenceColor: Record<Opportunity['confidence'], string> = {
  alta: 'text-accent',
  media: 'text-warn',
  baixa: 'text-muted'
};

export default function OpportunityCard({
  opportunity,
  onView,
  onRegister
}: {
  opportunity: Opportunity;
  onView: () => void;
  onRegister: () => void;
}) {
  const first = opportunity.selections[0];
  const title =
    opportunity.selections.length === 1
      ? `${first.homeTeam} x ${first.awayTeam}`
      : `${opportunity.selections.length} seleções combinadas`;

  return (
    <div className="rounded-lg border border-border bg-panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted">{first.league}</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-panel2 border border-border">
          {typeLabel[opportunity.type]}
        </span>
      </div>

      <div>
        <div className="text-sm text-muted">
          {new Date(first.commenceTime).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </div>
        <div className="text-lg font-semibold">{title}</div>
        {opportunity.selections.map((s, i) => (
          <div key={i} className="text-sm text-slate-300">
            {s.marketLabel}: <span className="font-medium">{s.outcomeName}</span>{' '}
            <span className="text-muted">@ {s.odd.toFixed(2)} ({s.bookmaker})</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs bg-panel2 rounded p-2 border border-border">
        <Metric label="Odd" value={opportunity.combinedOdd.toFixed(2)} />
        <Metric label="Prob. mercado" value={pct(opportunity.marketProbability)} />
        <Metric label="Prob. modelo" value={pct(opportunity.modelProbability)} />
        <Metric label="Edge" value={pct(opportunity.edge)} highlight={opportunity.edge > 0} />
        <Metric label="Valor esperado" value={opportunity.expectedValue.toFixed(3)} highlight={opportunity.expectedValue > 0} />
        <Metric label="Score" value={opportunity.score.toFixed(1)} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="Stake sugerida" value={money(opportunity.suggestedStake)} />
        <Metric label="Retorno potencial" value={money(opportunity.potentialReturn)} />
        <Metric label="Lucro potencial" value={money(opportunity.potentialProfit)} />
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className={`text-xs font-semibold uppercase ${confidenceColor[opportunity.confidence]}`}>
          Confiança {opportunity.confidence} · {opportunity.modelVersion}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onView}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-panel2 transition"
          >
            VER ANÁLISE
          </button>
          <button
            onClick={onRegister}
            className="text-xs px-3 py-1.5 rounded bg-accent text-black font-semibold hover:opacity-90 transition"
          >
            REGISTRAR
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className={`font-medium ${highlight ? 'text-accent' : ''}`}>{value}</div>
    </div>
  );
}
