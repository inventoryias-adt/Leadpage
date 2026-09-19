import { describe, it, expect } from 'vitest';
import { computeStake, impliedProbability, devig } from '../markets';
import type { UserSettings } from '../../types';

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
