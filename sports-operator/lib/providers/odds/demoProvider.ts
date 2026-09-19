import type { Game } from '../../types';
import type { OddsProvider } from './types';

// Deterministic-ish demo data so the UI is always populated when no real
// odds API is configured. Clearly flagged as DEMO everywhere it is surfaced.
function todayAt(hour: number, minute: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
  return d.toISOString();
}

function buildGame(
  id: string,
  league: string,
  hour: number,
  minute: number,
  home: string,
  away: string,
  homeOdd: number,
  drawOdd: number,
  awayOdd: number,
  overOdd: number,
  underOdd: number,
  bttsYes: number,
  bttsNo: number,
  // Optional line-shopping override: a second bookmaker occasionally prices
  // an outcome noticeably better than the reference book. This mirrors real
  // markets, where odds vary enough across books that genuine value appears
  // without any single book being "wrong" about the fair probability.
  fairPlayOverride?: { home?: number; draw?: number; away?: number }
): Game {
  return {
    id,
    league,
    commenceTime: todayAt(hour, minute),
    homeTeam: home,
    awayTeam: away,
    markets: [
      {
        marketKey: 'h2h',
        marketLabel: 'Resultado Final (1X2)',
        bookmaker: 'DemoBet',
        outcomes: [
          { name: home, price: homeOdd },
          { name: 'Empate', price: drawOdd },
          { name: away, price: awayOdd }
        ]
      },
      {
        marketKey: 'h2h',
        marketLabel: 'Resultado Final (1X2)',
        bookmaker: 'FairPlay Odds',
        outcomes: [
          { name: home, price: fairPlayOverride?.home ?? +(homeOdd * 0.98).toFixed(2) },
          { name: 'Empate', price: fairPlayOverride?.draw ?? +(drawOdd * 1.02).toFixed(2) },
          { name: away, price: fairPlayOverride?.away ?? +(awayOdd * 0.99).toFixed(2) }
        ]
      },
      {
        marketKey: 'over_under_2_5',
        marketLabel: 'Mais/Menos 2.5 Gols',
        bookmaker: 'DemoBet',
        outcomes: [
          { name: 'Mais de 2.5 gols', price: overOdd },
          { name: 'Menos de 2.5 gols', price: underOdd }
        ]
      },
      {
        marketKey: 'btts',
        marketLabel: 'Ambas Marcam',
        bookmaker: 'DemoBet',
        outcomes: [
          { name: 'Sim', price: bttsYes },
          { name: 'Não', price: bttsNo }
        ]
      }
    ]
  };
}

export class DemoOddsProvider implements OddsProvider {
  name = 'demo';
  isDemo = true;

  async fetchUpcomingGames(): Promise<Game[]> {
    return [
      buildGame('demo-1', 'Brasileirão Série A', 16, 0, 'Flamengo', 'Palmeiras', 2.1, 3.3, 3.4, 1.85, 1.95, 1.7, 2.05),
      buildGame('demo-2', 'Brasileirão Série A', 18, 30, 'Corinthians', 'São Paulo', 2.6, 3.1, 2.8, 1.9, 1.9, 1.85, 1.95),
      buildGame('demo-3', 'La Liga', 13, 0, 'Real Madrid', 'Sevilla', 1.45, 4.5, 6.5, 1.7, 2.1, 2.0, 1.75, { home: 1.65 }),
      buildGame('demo-4', 'Premier League', 11, 30, 'Manchester City', 'Everton', 1.3, 5.5, 9.0, 1.55, 2.4, 2.1, 1.68),
      buildGame('demo-5', 'Serie A (Itália)', 15, 45, 'Inter de Milão', 'Roma', 1.9, 3.4, 3.9, 1.95, 1.85, 1.9, 1.85),
      buildGame('demo-6', 'Bundesliga', 12, 30, 'Bayern de Munique', 'Stuttgart', 1.35, 5.2, 8.0, 1.5, 2.5, 1.75, 2.0, { home: 1.75 })
    ];
  }
}
