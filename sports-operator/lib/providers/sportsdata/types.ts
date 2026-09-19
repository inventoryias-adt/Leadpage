// A finished, historical match result. This is the raw input the football
// model needs and that the odds provider (lib/providers/odds/) does NOT
// supply — the odds provider only knows about upcoming fixtures + prices.
export interface HistoricalMatch {
  date: string; // ISO date of kickoff
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

export interface SportsDataProvider {
  name: string;
  /** True when the underlying data is synthetic/fake — must never be used as evidence of model performance. */
  synthetic: boolean;
  /**
   * Returns finished matches for a league, most recent last, strictly
   * before `asOf` (exclusive) — callers rely on this boundary to avoid
   * data leakage in backtests.
   */
  fetchHistoricalMatches(league: string, asOf: Date, lookbackDays: number): Promise<HistoricalMatch[]>;
}
