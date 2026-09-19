import { describe, it, expect } from 'vitest';
import { resolveCompetitionCode } from '../footballDataOrgProvider';

// Regression test for a real bug found while testing against the live
// stack: DemoOddsProvider and TheOddsApiProvider label the SAME league
// differently ('Premier League' vs 'EPL', 'Serie A (Itália)' vs
// 'Serie A - Italy', ...). Both must resolve to the same football-data.org
// competition code, or real games silently fall into NO BET with
// "sem histórico suficiente" even though the league IS covered.
describe('resolveCompetitionCode', () => {
  it('resolves both DemoOddsProvider and The Odds API labels to the same code', () => {
    const pairs: [string, string][] = [
      ['Premier League', 'EPL'],
      ['La Liga', 'La Liga - Spain'],
      ['Serie A (Itália)', 'Serie A - Italy'],
      ['Bundesliga', 'Bundesliga - Germany'],
      ['Ligue 1', 'Ligue 1 - France'],
      ['Champions League', 'UEFA Champions League'],
      ['Europa League', 'UEFA Europa League']
    ];

    for (const [demoLabel, realLabel] of pairs) {
      const demoCode = resolveCompetitionCode(demoLabel);
      const realCode = resolveCompetitionCode(realLabel);
      expect(demoCode).not.toBeNull();
      expect(demoCode).toBe(realCode);
    }
  });

  it('returns null (not a crash) for an uncovered league, e.g. Brasileirão', () => {
    expect(resolveCompetitionCode('Brasileirão Série A')).toBeNull();
    expect(resolveCompetitionCode('Brazil Série A')).toBeNull();
  });
});
