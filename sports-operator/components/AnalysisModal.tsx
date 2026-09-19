'use client';

import type { Opportunity } from '../lib/types';

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

export default function AnalysisModal({
  opportunity,
  onClose
}: {
  opportunity: Opportunity;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-panel border border-border rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Análise da Oportunidade</h2>
          <button onClick={onClose} className="text-muted hover:text-white text-xl leading-none">
            ×
          </button>
        </div>

        <p className="text-sm text-muted mb-4">
          Dados que fundamentaram a aprovação desta oportunidade pelo motor de análise configurado.
          A probabilidade do modelo é uma <strong>estimativa</strong>, não uma garantia de resultado.
        </p>

        {opportunity.selections.map((s, i) => (
          <div key={i} className="border border-border rounded p-3 mb-3 bg-panel2">
            <div className="text-xs uppercase text-muted mb-1">{s.league}</div>
            <div className="font-semibold mb-1">
              {s.homeTeam} x {s.awayTeam}
            </div>
            <div className="text-sm mb-2">
              Mercado: {s.marketLabel} — Seleção: <strong>{s.outcomeName}</strong> — Casa: {s.bookmaker}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Row label="Odd" value={s.odd.toFixed(2)} />
              <Row label="Probabilidade implícita (odd)" value={pct(s.impliedProbability)} />
              <Row label="Probabilidade estimada (modelo)" value={pct(s.modelProbability)} />
              <Row label="Edge (modelo - implícita)" value={pct(s.edge)} />
              <Row label="Valor esperado (por 1 unidade)" value={s.expectedValue.toFixed(4)} />
              <Row label="Score" value={s.score.toFixed(2)} />
            </dl>
          </div>
        ))}

        <div className="border-t border-border pt-3 mt-2">
          <h3 className="font-semibold mb-2">Combinação</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Row label="Odd combinada" value={opportunity.combinedOdd.toFixed(2)} />
            <Row label="Probabilidade implícita combinada" value={pct(opportunity.impliedProbability)} />
            <Row label="Probabilidade estimada combinada" value={pct(opportunity.modelProbability)} />
            <Row label="Edge combinado" value={pct(opportunity.edge)} />
            <Row label="Valor esperado combinado" value={opportunity.expectedValue.toFixed(4)} />
            <Row label="Score final" value={opportunity.score.toFixed(2)} />
          </dl>
        </div>

        {opportunity.selections.length > 1 && (
          <p className="text-xs text-muted mt-4">
            Múltipla composta apenas por seleções de jogos diferentes (sem correlação direta entre elas).
            Combinações com seleções do mesmo jogo nunca são recomendadas nesta V1, pois a
            multiplicação simples de probabilidades não seria correta nesse caso.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </>
  );
}
