'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EntryRecord, Game, Opportunity, UserSettings } from '../lib/types';
import { computeStats } from '../lib/stats';
import OpportunityCard from './OpportunityCard';
import AnalysisModal from './AnalysisModal';
import SettingsModal from './SettingsModal';
import HistoryPanel from './HistoryPanel';

type Filter = 'todos' | 'alta' | 'simple' | 'multiple' | 'no_bet';
type Tab = 'jogos' | 'historico';

function money(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('jogos');
  const [games, setGames] = useState<Game[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [demo, setDemo] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todos');
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  async function loadSettings() {
    const res = await fetch('/api/settings');
    setSettings(await res.json());
  }

  async function loadEntries() {
    const res = await fetch('/api/entries');
    setEntries(await res.json());
  }

  async function loadGamesAndOpportunities() {
    setLoading(true);
    setError(null);
    try {
      const [gamesRes, oppsRes] = await Promise.all([
        fetch('/api/games', { cache: 'no-store' }),
        fetch('/api/opportunities', { cache: 'no-store' })
      ]);
      const gamesJson = await gamesRes.json();
      const oppsJson = await oppsRes.json();

      setGames(gamesJson.games ?? []);
      setDemo(Boolean(gamesJson.demo));
      setProviderName(gamesJson.provider ?? '');
      setOpportunities(oppsJson.opportunities ?? []);

      if (gamesJson.error) setError(gamesJson.error);
      else if (oppsJson.error) setError(oppsJson.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadEntries();
    loadGamesAndOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => computeStats(entries), [entries]);

  const gamesWithoutOpportunity = useMemo(() => {
    const coveredGameIds = new Set(opportunities.flatMap((o) => o.selections.map((s) => s.gameId)));
    return games.filter((g) => !coveredGameIds.has(g.id));
  }, [games, opportunities]);

  const filteredOpportunities = useMemo(() => {
    switch (filter) {
      case 'alta':
        return opportunities.filter((o) => o.confidence === 'alta');
      case 'simple':
        return opportunities.filter((o) => o.type === 'simple');
      case 'multiple':
        return opportunities.filter((o) => o.type === 'multiple');
      case 'no_bet':
        return [];
      default:
        return opportunities;
    }
  }, [opportunities, filter]);

  async function handleSaveSettings(s: UserSettings) {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Erro ao salvar configurações.');
    }
    const saved = await res.json();
    setSettings(saved);
    await loadGamesAndOpportunities();
  }

  async function handleRegister(opportunity: Opportunity) {
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity })
    });
    if (res.ok) {
      await loadEntries();
      setTab('historico');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erro ao registrar entrada.');
    }
  }

  async function handleSettle(id: string, status: 'win' | 'loss' | 'void') {
    const res = await fetch(`/api/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) await loadEntries();
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">SPORTS OPERATOR</h1>
          <div className="flex items-center gap-2">
            {demo && (
              <span className="text-xs font-semibold px-2 py-1 rounded bg-warn/20 text-warn border border-warn/40">
                MODO DEMO
              </span>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="text-sm px-3 py-1.5 rounded border border-border hover:bg-panel2"
            >
              Configurações
            </button>
          </div>
        </div>

        {settings && (
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span>Banca: <strong className="text-slate-100">{money(settings.bankroll)}</strong></span>
            <span>Stake configurada: <strong className="text-slate-100">{settings.stakePercent}%</strong></span>
            <span>Meta de lucro: <strong className="text-slate-100">{settings.profitTarget}%</strong></span>
            <span>Prob. mínima: <strong className="text-slate-100">{(settings.minProbability * 100).toFixed(0)}%</strong></span>
            <span>Odds: <strong className="text-slate-100">{settings.minOdd.toFixed(2)} – {settings.maxOdd.toFixed(2)}</strong></span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={loadGamesAndOpportunities}
            disabled={loading}
            className="px-4 py-2 rounded bg-accent text-black font-semibold text-sm disabled:opacity-50"
          >
            {loading ? 'ATUALIZANDO…' : 'ATUALIZAR JOGOS'}
          </button>
          <span className="text-xs text-muted">
            Provider: {providerName || '—'} {demo && '(dados fictícios)'}
          </span>
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded p-2">
            Erro: {error}
          </p>
        )}

        <nav className="flex gap-2 border-b border-border">
          <TabButton active={tab === 'jogos'} onClick={() => setTab('jogos')}>JOGOS DE HOJE</TabButton>
          <TabButton active={tab === 'historico'} onClick={() => setTab('historico')}>HISTÓRICO / GESTÃO DE BANCA</TabButton>
        </nav>
      </header>

      {tab === 'jogos' && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === 'todos'} onClick={() => setFilter('todos')}>Todos</FilterButton>
            <FilterButton active={filter === 'alta'} onClick={() => setFilter('alta')}>Alta confiança</FilterButton>
            <FilterButton active={filter === 'simple'} onClick={() => setFilter('simple')}>Simples</FilterButton>
            <FilterButton active={filter === 'multiple'} onClick={() => setFilter('multiple')}>Múltiplas</FilterButton>
            <FilterButton active={filter === 'no_bet'} onClick={() => setFilter('no_bet')}>NO BET</FilterButton>
          </div>

          {filter === 'no_bet' ? (
            <div className="flex flex-col gap-3">
              {gamesWithoutOpportunity.length === 0 && (
                <p className="text-muted text-sm">Todos os jogos do dia tiveram alguma oportunidade qualificada.</p>
              )}
              {gamesWithoutOpportunity.map((g) => (
                <div key={g.id} className="rounded-lg border border-border bg-panel p-4">
                  <div className="text-xs uppercase text-muted mb-1">{g.league}</div>
                  <div className="font-semibold">{g.homeTeam} x {g.awayTeam}</div>
                  <div className="text-xs text-warn font-semibold mt-2">NO BET — nenhuma seleção atende aos parâmetros configurados (probabilidade mínima, faixa de odd ou edge positivo).</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpportunities.map((o) => (
                <OpportunityCard
                  key={o.id}
                  opportunity={o}
                  onView={() => setSelected(o)}
                  onRegister={() => handleRegister(o)}
                />
              ))}
              {filteredOpportunities.length === 0 && (
                <p className="text-muted text-sm col-span-full">Nenhuma oportunidade encontrada para este filtro.</p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'historico' && (
        <HistoryPanel entries={entries} stats={stats} onSettle={handleSettle} />
      )}

      {selected && <AnalysisModal opportunity={selected} onClose={() => setSelected(null)} />}
      {showSettings && settings && (
        <SettingsModal settings={settings} onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
        active ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border ${
        active ? 'bg-accent text-black border-accent font-semibold' : 'border-border text-muted hover:bg-panel2'
      }`}
    >
      {children}
    </button>
  );
}
