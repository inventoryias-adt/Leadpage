import { describe, it, expect } from 'vitest';
import { computeStake, impliedProbability, devig, normalizeTeamName, findRatingKey } from '../markets';
import type { UserSettings } from '../../types';
import type { LeagueRatings } from '../models/footballV1';

describe('computeStake', () => {
  it('matches the spec example exactly: bankroll 5, stake 100%, odd 1.5 -> stake 5, return 7.5, profit 2.5', () => {
    const settings: UserSettings = {
      bankroll: 5,
      stakePercent: 100,
      maxStake: 100,
      profitTarget: 10,
      minProbability: 0.01,
      minOdd: 1,
      maxOdd: 10,
      maxLegsMultiple: 2
    };
    const { stake, potentialReturn, potentialProfit } = computeStake(settings, 1.5);
    expect(stake).toBe(5);
    expect(potentialReturn).toBe(7.5);
    expect(potentialProfit).toBe(2.5);
  });

  it('caps stake at maxStake even when stakePercent*bankroll would exceed it', () => {
    const settings: UserSettings = { bankroll: 1000, stakePercent: 10, maxStake: 20, profitTarget: 10, minProbability: 0.01, minOdd: 1, maxOdd: 10, maxLegsMultiple: 2 };
    const { stake } = computeStake(settings, 2);
    expect(stake).toBe(20); // 10% of 1000 = 100, but capped at 20
  });
});

describe('impliedProbability / devig', () => {
  it('impliedProbability is exactly 1/odd', () => {
    expect(impliedProbability(2)).toBeCloseTo(0.5, 10);
    expect(impliedProbability(4)).toBeCloseTo(0.25, 10);
  });

  it('devig normalizes a full market to sum to 1 (removes bookmaker margin)', () => {
    // Raw implied probs sum to > 1 (overround) for realistic odds.
    const fair = devig([{ price: 2.1 }, { price: 3.3 }, { price: 3.4 }]);
    const sum = fair.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    fair.forEach((p) => {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    });
  });
});

describe('edge and expected value math', () => {
  it('edge is modelProbability minus the raw (vig-included) implied probability of the best odd', () => {
    const modelProbability = 0.65;
    const odd = 2.0; // implied 0.5
    const edge = modelProbability - impliedProbability(odd);
    expect(edge).toBeCloseTo(0.15, 10);
  });

  it('expected value follows EV = p*(odd-1) - (1-p), correct sign for +EV and -EV bets', () => {
    const evFor = (p: number, odd: number) => p * (odd - 1) - (1 - p);

    // Fair coin at fair odds (2.0) has EV = 0.
    expect(evFor(0.5, 2.0)).toBeCloseTo(0, 10);
    // Higher true probability than break-even -> positive EV.
    expect(evFor(0.6, 2.0)).toBeGreaterThan(0);
    // Lower true probability than break-even -> negative EV.
    expect(evFor(0.4, 2.0)).toBeLessThan(0);
  });
});

describe('normalizeTeamName / findRatingKey (cross-provider name matching)', () => {
  it('matches names differing only by a club affix (FC, AS, VfB, ...)', () => {
    expect(normalizeTeamName('Roma')).toBe(normalizeTeamName('AS Roma'));
    expect(normalizeTeamName('Stuttgart')).toBe(normalizeTeamName('VfB Stuttgart'));
    expect(normalizeTeamName('Everton')).toBe(normalizeTeamName('Everton FC'));
  });

  it('matches known Portuguese-translated nicknames to their official name', () => {
    expect(normalizeTeamName('Inter de Milão')).toBe(normalizeTeamName('FC Internazionale Milano'));
    expect(normalizeTeamName('Bayern de Munique')).toBe(normalizeTeamName('FC Bayern München'));
  });

  it('findRatingKey resolves the odds-provider name to the sportsdata-provider key', () => {
    const ratings: LeagueRatings = {
      league: 'Serie A (Itália)',
      asOf: new Date().toISOString(),
      avgHomeGoals: 1.4,
      avgAwayGoals: 1.1,
      teams: {
        'FC Internazionale Milano': { attackHome: 1, defenseHome: 1, attackAway: 1, defenseAway: 1, matchesUsed: 20 },
        'AS Roma': { attackHome: 1, defenseHome: 1, attackAway: 1, defenseAway: 1, matchesUsed: 20 }
      }
    };
    expect(findRatingKey(ratings, 'Inter de Milão')).toBe('FC Internazionale Milano');
    expect(findRatingKey(ratings, 'Roma')).toBe('AS Roma');
    expect(findRatingKey(ratings, 'Totally Unknown FC')).toBeNull();
  });
});
