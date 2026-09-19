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

        <div className="rounded border border-accent/40 bg-accent/10 p-3 mb-4">
          <div className="text-xs font-semibold uppercase text-accent mb-1">O que fazer</div>
          <ol className="text-sm text-slate-200 list-decimal list-inside space-y-1">
            {opportunity.selections.map((s, i) => (
              <li key={i}>
                Aposte na seleção <strong>&quot;{s.outcomeName}&quot;</strong> do mercado {s.marketLabel} no jogo{' '}
                {s.homeTeam} x {s.awayTeam}, na casa <strong>{s.bookmaker}</strong>, odd {s.odd.toFixed(2)}.
              </li>
            ))}
            <li>
              Valor a apostar: <strong>{opportunity.suggestedStake.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>{' '}
              {opportunity.selections.length > 1 && 'no total da múltipla '}
              na odd combinada {opportunity.combinedOdd.toFixed(2)}.
            </li>
            <li>
              Se vencer: retorno de{' '}
              <strong>{opportunity.potentialReturn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>{' '}
              (lucro de {opportunity.potentialProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).
              Se perder: prejuízo limitado ao valor apostado.
            </li>
          </ol>
          <p className="text-xs text-muted mt-2">
            Isso é a saída do motor de análise, com base na sua configuração atual de banca, stake e filtros —{' '}
            <strong>não é uma garantia de resultado</strong>. A probabilidade do modelo é uma estimativa, sujeita ao
            erro do modelo e à qualidade dos dados usados (ver detalhes abaixo).
          </p>
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
              <Row label="Probabilidade de mercado (de-vigada, benchmark)" value={pct(s.marketProbability)} />
              <Row label="Probabilidade do modelo (independente)" value={pct(s.modelProbability)} />
              <Row label="Edge (modelo - implícita da odd)" value={pct(s.edge)} />
              <Row label="Valor esperado (por 1 unidade)" value={s.expectedValue.toFixed(4)} />
              <Row label="Score" value={s.score.toFixed(2)} />
              <Row label="Versão do modelo" value={s.modelVersion} />
              <Row
                label="Amostra usada (mandante / visitante)"
                value={`${s.dataQuality.homeMatchesUsed} / ${s.dataQuality.awayMatchesUsed} jogos`}
              />
              <Row label="Dados sintéticos?" value={s.dataQuality.synthetic ? 'Sim — não usar como evidência' : 'Não'} />
            </dl>
          </div>
        ))}

        <div className="border-t border-border pt-3 mt-2">
          <h3 className="font-semibold mb-2">Combinação</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Row label="Odd combinada" value={opportunity.combinedOdd.toFixed(2)} />
            <Row label="Probabilidade de mercado combinada" value={pct(opportunity.marketProbability)} />
            <Row label="Probabilidade do modelo combinada" value={pct(opportunity.modelProbability)} />
            <Row label="Edge combinado" value={pct(opportunity.edge)} />
            <Row label="Valor esperado combinado" value={opportunity.expectedValue.toFixed(4)} />
            <Row label="Score final" value={opportunity.score.toFixed(2)} />
            <Row label="Versão do modelo" value={opportunity.modelVersion} />
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
