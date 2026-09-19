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

// Club-type words/particles commonly present in one provider's naming but
// absent in another's (e.g. odds providers often drop "FC"/"AS"/"VfB",
// official football-data.org names keep them). Stripped as whole words so
// we never eat into a real name (e.g. "Sporting CP" keeps "Sporting").
const CLUB_AFFIXES = /\b(fc|cf|sc|ac|afc|cfc|ssc|ssd|as|ud|cd|sd|vfb|vfl|tsg|sv|sg|calcio|clube|futebol|futbol|club|de|do|da)\b/g;

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Known translation aliases: a handful of clubs are commonly referred to by
// a nickname or a translated city name in Portuguese-language sources (as
// used by this app's DEMO odds data) that differs from the official name
// football-data.org returns. This is a small, explicit, documented list —
// not a general translation engine — scoped to cases actually observed.
const TEAM_ALIASES: Record<string, string> = {
  intermilao: 'intermilan',
  internazionalemilano: 'intermilan',
  intermilan: 'intermilan',
  bayernmunique: 'bayernmunich',
  bayernmunchen: 'bayernmunich',
  bayernmunich: 'bayernmunich'
};

export function normalizeTeamName(name: string): string {
  const base = stripDiacritics(name.toLowerCase())
    .replace(CLUB_AFFIXES, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return TEAM_ALIASES[base] ?? base;
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

// Turns a raw outcome name ("Le Havre", "Over", "Draw", "Sim") into a
// full, unambiguous sentence fragment for display ("Vitória do Le Havre",
// "Mais de 2.5 gols", "Empate", "Ambas equipes marcam: Sim"). The raw names
// are correct for matching/math but meaningless on their own to someone who
// doesn't already know the market convention.
export function buildClearOutcomeLabel(
  marketKey: MarketKey,
  outcomeName: string,
  homeTeam: string,
  awayTeam: string
): string {
  if (marketKey === 'h2h') {
    if (outcomeName === homeTeam) return `Vitória do ${homeTeam}`;
    if (outcomeName === awayTeam) return `Vitória do ${awayTeam}`;
    if (/empate|draw/i.test(outcomeName)) return 'Empate';
    return outcomeName;
  }
  if (marketKey === 'btts') {
    if (isBttsYes(outcomeName)) return 'Ambas equipes marcam: Sim';
    if (isBttsNo(outcomeName)) return 'Ambas equipes marcam: Não';
    return outcomeName;
  }
  // over_under_2_5: outcome names are already built as clear Portuguese
  // sentences ("Mais de 2.5 gols") by the providers, so pass through as-is.
  return outcomeName;
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
