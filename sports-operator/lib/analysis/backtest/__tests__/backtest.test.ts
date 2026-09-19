import { describe, it, expect } from 'vitest';
import { computeLeagueRatings } from '../../models/footballV1';
import { runBacktest, type HistoricalOddsQuote } from '../backtest';
import type { HistoricalMatch } from '../../../providers/sportsdata/types';
import type { UserSettings } from '../../../types';

function makeMatch(date: string, home: string, away: string, hg: number, ag: number): HistoricalMatch {
  return { date, league: 'Test League', homeTeam: home, awayTeam: away, homeGoals: hg, awayGoals: ag };
}

function buildBaseMatches(): HistoricalMatch[] {
  const matches: HistoricalMatch[] = [];
  for (let i = 0; i < 8; i++) {
    matches.push(makeMatch(`2024-01-${String(1 + i * 2).padStart(2, '0')}T00:00:00.000Z`, 'A', 'B', 2, 1));
    matches.push(makeMatch(`2024-01-${String(2 + i * 2).padStart(2, '0')}T00:00:00.000Z`, 'B', 'A', 1, 2));
  }
  return matches;
}

describe('data leakage guard', () => {
  it('excludes a match dated exactly at asOf (strict inequality, not <=)', () => {
    const matches = buildBaseMatches();
    const boundaryDate = new Date(matches[matches.length - 1].date);
    const ratingsExcludingBoundary = computeLeagueRatings(matches, boundaryDate, 'Test League');
    // The last match's own date used as asOf must NOT count itself.
    const matchesUsed = ratingsExcludingBoundary?.teams['A']?.matchesUsed ?? 0;
    const totalAmatches = matches.filter((m) => m.homeTeam === 'A' || m.awayTeam === 'A').length;
    expect(matchesUsed).toBeLessThan(totalAmatches);
  });

  it('ratings computed for an earlier match are unaffected by matches added AFTER it in time', () => {
    const base = buildBaseMatches();
    const asOfEarly = new Date('2024-01-10T00:00:00.000Z');

    const ratingsBefore = computeLeagueRatings(base, asOfEarly, 'Test League');

    // Append a "poison" future match with an extreme, rating-distorting
    // scoreline far in the future relative to asOfEarly.
    const poisoned = [...base, makeMatch('2024-06-01T00:00:00.000Z', 'A', 'B', 10, 0)];
    const ratingsAfterPoison = computeLeagueRatings(poisoned, asOfEarly, 'Test League');

    expect(ratingsAfterPoison?.teams['A'].attackHome).toBeCloseTo(ratingsBefore!.teams['A'].attackHome, 10);
    expect(ratingsAfterPoison?.teams['A'].matchesUsed).toBe(ratingsBefore!.teams['A'].matchesUsed);
  });

  it('runBacktest never lets a future poison match change an earlier record', () => {
    const base = buildBaseMatches();
    const settings: UserSettings = { bankroll: 100, stakePercent: 2, maxStake: 20, profitTarget: 10, minProbability: 0.01, minOdd: 1, maxOdd: 10, maxLegsMultiple: 2 };

    const quotesFor = (matches: HistoricalMatch[]): HistoricalOddsQuote[] =>
      matches.flatMap((m) => [
        { date: m.date, league: m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, marketKey: 'h2h' as const, marketLabel: '1X2', outcomeName: m.homeTeam, price: 2.0, bookmaker: 'Test' },
        { date: m.date, league: m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, marketKey: 'h2h' as const, marketLabel: '1X2', outcomeName: 'Empate', price: 3.5, bookmaker: 'Test' },
        { date: m.date, league: m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, marketKey: 'h2h' as const, marketLabel: '1X2', outcomeName: m.awayTeam, price: 4.0, bookmaker: 'Test' }
      ]);

    const reportBefore = runBacktest(base, quotesFor(base), settings, { synthetic: true });

    const poisoned = [...base, makeMatch('2024-06-01T00:00:00.000Z', 'A', 'B', 10, 0)];
    const reportAfter = runBacktest(poisoned, quotesFor(poisoned), settings, { synthetic: true });

    // Every record present in the "before" run must have an identical
    // counterpart in the "after" run (same modelProbability) — the extra
    // future match must only ever ADD a new record, never mutate old ones.
    for (const before of reportBefore.records) {
      const after = reportAfter.records.find(
        (r) => r.date === before.date && r.homeTeam === before.homeTeam && r.awayTeam === before.awayTeam && r.outcomeName === before.outcomeName
      );
      expect(after).toBeDefined();
      expect(after!.modelProbability).toBeCloseTo(before.modelProbability, 10);
    }
  });

  it('calibration samples count matches the number of resolved backtest records', () => {
    const base = buildBaseMatches();
    const settings: UserSettings = { bankroll: 100, stakePercent: 2, maxStake: 20, profitTarget: 10, minProbability: 0.01, minOdd: 1, maxOdd: 10, maxLegsMultiple: 2 };
    const quotes: HistoricalOddsQuote[] = base.flatMap((m) => [
      { date: m.date, league: m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, marketKey: 'h2h' as const, marketLabel: '1X2', outcomeName: m.homeTeam, price: 2.0, bookmaker: 'Test' },
      { date: m.date, league: m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, marketKey: 'h2h' as const, marketLabel: '1X2', outcomeName: 'Empate', price: 3.5, bookmaker: 'Test' },
      { date: m.date, league: m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, marketKey: 'h2h' as const, marketLabel: '1X2', outcomeName: m.awayTeam, price: 4.0, bookmaker: 'Test' }
    ]);
    const report = runBacktest(base, quotes, settings, { synthetic: true });
    expect(report.calibrationSamples.length).toBe(report.recordCount);
  });
});
