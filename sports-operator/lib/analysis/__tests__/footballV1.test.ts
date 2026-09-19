import { describe, it, expect } from 'vitest';
import { computeLeagueRatings, predictMatch, probabilityHomeWin, probabilityAwayWin, probabilityDraw, probabilityOver, probabilityBttsYes, MIN_MATCHES_PER_TEAM } from '../models/footballV1';
import type { HistoricalMatch } from '../../providers/sportsdata/types';

function makeMatch(date: string, home: string, away: string, hg: number, ag: number, league = 'Test League'): HistoricalMatch {
  return { date, league, homeTeam: home, awayTeam: away, homeGoals: hg, awayGoals: ag };
}

// Build a synthetic league where "Strong" always wins big at home and away,
// and "Weak" always loses — enough matches to clear MIN_MATCHES_PER_TEAM.
function buildLeague(): HistoricalMatch[] {
  const matches: HistoricalMatch[] = [];
  let day = 1;
  for (let i = 0; i < 10; i++) {
    matches.push(makeMatch(`2024-01-${String(day).padStart(2, '0')}T00:00:00.000Z`, 'Strong', 'Weak', 3, 0));
    day++;
    matches.push(makeMatch(`2024-01-${String(day).padStart(2, '0')}T00:00:00.000Z`, 'Weak', 'Strong', 0, 3));
    day++;
  }
  return matches;
}

describe('football-v1 Dixon-Coles model', () => {
  it('produces a probability grid that sums to ~1', () => {
    const matches = buildLeague();
    const asOf = new Date('2024-06-01T00:00:00.000Z');
    const ratings = computeLeagueRatings(matches, asOf, 'Test League');
    expect(ratings).not.toBeNull();
    const matrix = predictMatch(ratings!, 'Strong', 'Weak');
    expect(matrix).not.toBeNull();

    let sum = 0;
    for (const row of matrix!.grid) for (const p of row) sum += p;
    expect(sum).toBeCloseTo(1, 6);
  });

  it('gives the historically dominant home team a higher win probability than the weak away team', () => {
    const matches = buildLeague();
    const asOf = new Date('2024-06-01T00:00:00.000Z');
    const ratings = computeLeagueRatings(matches, asOf, 'Test League')!;
    const matrix = predictMatch(ratings, 'Strong', 'Weak')!;

    const homeWin = probabilityHomeWin(matrix);
    const awayWin = probabilityAwayWin(matrix);
    expect(homeWin).toBeGreaterThan(awayWin);
    expect(homeWin).toBeGreaterThan(0.5);
  });

  it('flags insufficient sample when a team has fewer than MIN_MATCHES_PER_TEAM matches', () => {
    const matches = [makeMatch('2024-01-01T00:00:00.000Z', 'Strong', 'Weak', 2, 0), makeMatch('2024-01-08T00:00:00.000Z', 'Weak', 'Strong', 0, 2)];
    expect(matches.length).toBeLessThan(MIN_MATCHES_PER_TEAM);
    const asOf = new Date('2024-06-01T00:00:00.000Z');
    const ratings = computeLeagueRatings(matches, asOf, 'Test League')!;
    const matrix = predictMatch(ratings, 'Strong', 'Weak')!;
    expect(matrix.dataQuality.sufficientSample).toBe(false);
  });

  it('returns null for a team not present in the ratings', () => {
    const matches = buildLeague();
    const asOf = new Date('2024-06-01T00:00:00.000Z');
    const ratings = computeLeagueRatings(matches, asOf, 'Test League')!;
    expect(predictMatch(ratings, 'Strong', 'Nonexistent FC')).toBeNull();
  });

  it('probabilities for draw/over/btts stay within [0,1]', () => {
    const matches = buildLeague();
    const asOf = new Date('2024-06-01T00:00:00.000Z');
    const ratings = computeLeagueRatings(matches, asOf, 'Test League')!;
    const matrix = predictMatch(ratings, 'Strong', 'Weak')!;
    expect(probabilityDraw(matrix)).toBeGreaterThanOrEqual(0);
    expect(probabilityDraw(matrix)).toBeLessThanOrEqual(1);
    expect(probabilityOver(matrix, 2.5)).toBeGreaterThanOrEqual(0);
    expect(probabilityOver(matrix, 2.5)).toBeLessThanOrEqual(1);
    expect(probabilityBttsYes(matrix)).toBeGreaterThanOrEqual(0);
    expect(probabilityBttsYes(matrix)).toBeLessThanOrEqual(1);
  });

  it('NEVER derives the model probability from 1/odd (fundamental rule)', () => {
    // The model probability functions take only a ScoreMatrix (built purely
    // from historical goals), and have no odd/price parameter anywhere in
    // their signature — structurally impossible to be "1/odd" in disguise.
    const matches = buildLeague();
    const asOf = new Date('2024-06-01T00:00:00.000Z');
    const ratings = computeLeagueRatings(matches, asOf, 'Test League')!;
    const matrix = predictMatch(ratings, 'Strong', 'Weak')!;
    const modelProb = probabilityHomeWin(matrix);

    // Sanity: same fixture at two wildly different hypothetical odds would
    // yield the exact same model probability, because odds never enter here.
    expect(typeof modelProb).toBe('number');
    expect(probabilityHomeWin.length).toBe(1); // signature only takes the matrix, nothing price-related
  });
});
