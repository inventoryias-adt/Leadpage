// Shared market-resolution helpers used by both the live engine and the
// backtester, so probability/outcome logic for each market type is defined
// exactly once.
import type { MarketKey, UserSettings } from '../types';
import type { LeagueRatings, ScoreMatrix } from './models/footballV1';
import {
  probabilityAwayWin,
  probabilityBttsNo,
  probabilityBttsYes,
  probabilityDraw,
  probabilityHomeWin,
  probabilityOver,
  probabilityUnder
} from './models/footballV1';

export function impliedProbability(odd: number): number {
  return 1 / odd;
}

// De-vigged "fair" market probability — used ONLY as a benchmark/feature,
// never as the model's own estimate.
export function devig(outcomes: { price: number }[]): number[] {
  const raw = outcomes.map((o) => impliedProbability(o.price));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((p) => p / sum);
}

export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|afc|cfc)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Best-effort match between an odds-provider team name and a sportsdata
// team name — real providers don't always agree on naming. When no match
// is found, the caller treats the team as unrated (insufficient data).
export function findRatingKey(ratings: LeagueRatings, teamName: string): string | null {
  if (ratings.teams[teamName]) return teamName;
  const normalized = normalizeTeamName(teamName);
  const match = Object.keys(ratings.teams).find((k) => normalizeTeamName(k) === normalized);
  return match ?? null;
}

export function extractLine(marketLabel: string, outcomeName: string): number {
  const match = `${marketLabel} ${outcomeName}`.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return 2.5;
  return parseFloat(match[1].replace(',', '.'));
}

export function isOverOutcome(outcomeName: string): boolean {
  return /mais|over/i.test(outcomeName);
}
export function isUnderOutcome(outcomeName: string): boolean {
  return /menos|under/i.test(outcomeName);
}
export function isBttsYes(outcomeName: string): boolean {
  return /^sim$|^yes$/i.test(outcomeName.trim());
}
export function isBttsNo(outcomeName: string): boolean {
  return /^n[ãa]o$|^no$/i.test(outcomeName.trim());
}

export function modelProbabilityFor(
  matrix: ScoreMatrix,
  marketKey: MarketKey,
  marketLabel: string,
  outcomeName: string,
  homeTeam: string,
  awayTeam: string
): number | null {
  if (marketKey === 'h2h') {
    if (outcomeName === homeTeam) return probabilityHomeWin(matrix);
    if (outcomeName === awayTeam) return probabilityAwayWin(matrix);
    if (/empate|draw/i.test(outcomeName)) return probabilityDraw(matrix);
    return null;
  }
  if (marketKey === 'over_under_2_5') {
    const line = extractLine(marketLabel, outcomeName);
    if (isOverOutcome(outcomeName)) return probabilityOver(matrix, line);
    if (isUnderOutcome(outcomeName)) return probabilityUnder(matrix, line);
    return null;
  }
  if (marketKey === 'btts') {
    if (isBttsYes(outcomeName)) return probabilityBttsYes(matrix);
    if (isBttsNo(outcomeName)) return probabilityBttsNo(matrix);
    return null;
  }
  return null;
}

/** Did the outcome actually happen, given the final score? Used by the backtester. */
export function resolveActualOutcome(
  marketKey: MarketKey,
  marketLabel: string,
  outcomeName: string,
  homeTeam: string,
  awayTeam: string,
  homeGoals: number,
  awayGoals: number
): 0 | 1 | null {
  if (marketKey === 'h2h') {
    if (outcomeName === homeTeam) return homeGoals > awayGoals ? 1 : 0;
    if (outcomeName === awayTeam) return awayGoals > homeGoals ? 1 : 0;
    if (/empate|draw/i.test(outcomeName)) return homeGoals === awayGoals ? 1 : 0;
    return null;
  }
  if (marketKey === 'over_under_2_5') {
    const line = extractLine(marketLabel, outcomeName);
    const total = homeGoals + awayGoals;
    if (isOverOutcome(outcomeName)) return total > line ? 1 : 0;
    if (isUnderOutcome(outcomeName)) return total < line ? 1 : 0;
    return null;
  }
  if (marketKey === 'btts') {
    const both = homeGoals > 0 && awayGoals > 0;
    if (isBttsYes(outcomeName)) return both ? 1 : 0;
    if (isBttsNo(outcomeName)) return !both ? 1 : 0;
    return null;
  }
  return null;
}

export function computeStake(settings: UserSettings, odd: number): { stake: number; potentialReturn: number; potentialProfit: number } {
  const rawStake = (settings.bankroll * settings.stakePercent) / 100;
  const stake = +Math.min(rawStake, settings.maxStake).toFixed(2);
  const potentialReturn = +(stake * odd).toFixed(2);
  const potentialProfit = +(potentialReturn - stake).toFixed(2);
  return { stake, potentialReturn, potentialProfit };
}
