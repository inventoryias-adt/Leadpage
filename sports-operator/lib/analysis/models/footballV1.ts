import type { HistoricalMatch } from '../../providers/sportsdata/types';

export const MODEL_VERSION = 'football-v1';

// --- Configuration -----------------------------------------------------
// Minimum finished matches a team must have (home + away combined) within
// the lookback window before we trust a rating for it. Below this, the
// model refuses to predict (see predictMatch returning null) instead of
// extrapolating from a tiny, noisy sample.
export const MIN_MATCHES_PER_TEAM = 6;

// Recency weighting: matches decay exponentially with this half-life so
// "forma recente" matters more than results from months ago, without
// discarding older matches outright (small samples stay usable).
const HALF_LIFE_DAYS = 60;

// Dixon-Coles low-score correlation parameter. Fixed at a conservative,
// literature-informed value (Dixon & Coles 1997 report values in roughly
// this range for English football) rather than fit via MLE on our data —
// we don't yet have enough real, labeled historical bets to estimate it
// reliably. TODO (v2): re-estimate rho once real backtest data accumulates.
const RHO = -0.08;

const MAX_GOALS = 8; // scoreline grid cap; P(goals > 8) is negligible for football

export interface TeamRatingInputs {
  attackHome: number;
  defenseHome: number;
  attackAway: number;
  defenseAway: number;
  matchesUsed: number;
}

export interface LeagueRatings {
  league: string;
  asOf: string;
  avgHomeGoals: number;
  avgAwayGoals: number;
  teams: Record<string, TeamRatingInputs>;
}

function decayWeight(matchDate: string, asOf: Date): number {
  const days = (asOf.getTime() - new Date(matchDate).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, Math.max(0, days) / HALF_LIFE_DAYS);
}

function weightedAverage(values: { value: number; weight: number }[]): number {
  const totalWeight = values.reduce((a, v) => a + v.weight, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((a, v) => a + v.value * v.weight, 0) / totalWeight;
}

/**
 * Computes attack/defense strength ratios per team from historical results,
 * strictly using only matches before `asOf` (caller is responsible for
 * that filtering — see backtest module for the leakage guard).
 *
 * This is a simplified estimator (weighted goal ratios relative to league
 * average), not a full Dixon-Coles maximum-likelihood fit. It is the
 * standard "first pass" approach and is explainable and cheap to compute,
 * at the cost of being less precise than a proper MLE fit — an explicit,
 * documented limitation of football-v1.
 */
export function computeLeagueRatings(matches: HistoricalMatch[], asOf: Date, league: string): LeagueRatings | null {
  const leagueMatches = matches.filter((m) => m.league === league && new Date(m.date).getTime() < asOf.getTime());
  if (leagueMatches.length === 0) return null;

  const weighted = leagueMatches.map((m) => ({ match: m, weight: decayWeight(m.date, asOf) }));

  const avgHomeGoals = weightedAverage(weighted.map((w) => ({ value: w.match.homeGoals, weight: w.weight })));
  const avgAwayGoals = weightedAverage(weighted.map((w) => ({ value: w.match.awayGoals, weight: w.weight })));

  const teamNames = new Set<string>();
  leagueMatches.forEach((m) => {
    teamNames.add(m.homeTeam);
    teamNames.add(m.awayTeam);
  });

  const teams: Record<string, TeamRatingInputs> = {};

  for (const team of teamNames) {
    const homeGames = weighted.filter((w) => w.match.homeTeam === team);
    const awayGames = weighted.filter((w) => w.match.awayTeam === team);

    // attackHome: how many goals this team scores at home vs league average home scoring.
    const goalsScoredHome = weightedAverage(homeGames.map((w) => ({ value: w.match.homeGoals, weight: w.weight })));
    // defenseHome: how many goals this team concedes at home vs league average away scoring.
    const goalsConcededHome = weightedAverage(homeGames.map((w) => ({ value: w.match.awayGoals, weight: w.weight })));
    const goalsScoredAway = weightedAverage(awayGames.map((w) => ({ value: w.match.awayGoals, weight: w.weight })));
    const goalsConcededAway = weightedAverage(awayGames.map((w) => ({ value: w.match.homeGoals, weight: w.weight })));

    teams[team] = {
      attackHome: avgHomeGoals > 0 ? goalsScoredHome / avgHomeGoals : 1,
      defenseHome: avgAwayGoals > 0 ? goalsConcededHome / avgAwayGoals : 1,
      attackAway: avgAwayGoals > 0 ? goalsScoredAway / avgAwayGoals : 1,
      defenseAway: avgHomeGoals > 0 ? goalsConcededAway / avgHomeGoals : 1,
      matchesUsed: homeGames.length + awayGames.length
    };
  }

  return { league, asOf: asOf.toISOString(), avgHomeGoals, avgAwayGoals, teams };
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

// Dixon-Coles tau correction for the four low-scoring cells where plain
// independent Poisson is known to be biased.
function tau(homeGoals: number, awayGoals: number, lambdaHome: number, lambdaAway: number, rho: number): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

export interface ScoreMatrix {
  homeTeam: string;
  awayTeam: string;
  lambdaHome: number;
  lambdaAway: number;
  grid: number[][]; // grid[home][away] = probability
  dataQuality: {
    sufficientSample: boolean;
    homeMatchesUsed: number;
    awayMatchesUsed: number;
  };
}

export function predictMatch(ratings: LeagueRatings, homeTeam: string, awayTeam: string): ScoreMatrix | null {
  const home = ratings.teams[homeTeam];
  const away = ratings.teams[awayTeam];
  if (!home || !away) return null;

  const lambdaHome = ratings.avgHomeGoals * home.attackHome * away.defenseAway;
  const lambdaAway = ratings.avgAwayGoals * away.attackAway * home.defenseHome;

  const grid: number[][] = [];
  let sum = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    grid[h] = [];
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway) * tau(h, a, lambdaHome, lambdaAway, RHO);
      grid[h][a] = Math.max(0, p);
      sum += grid[h][a];
    }
  }
  // Normalize (tau adjustment can shift the total slightly away from 1).
  if (sum > 0) {
    for (let h = 0; h <= MAX_GOALS; h++) {
      for (let a = 0; a <= MAX_GOALS; a++) {
        grid[h][a] /= sum;
      }
    }
  }

  return {
    homeTeam,
    awayTeam,
    lambdaHome,
    lambdaAway,
    grid,
    dataQuality: {
      sufficientSample: home.matchesUsed >= MIN_MATCHES_PER_TEAM && away.matchesUsed >= MIN_MATCHES_PER_TEAM,
      homeMatchesUsed: home.matchesUsed,
      awayMatchesUsed: away.matchesUsed
    }
  };
}

export function probabilityHomeWin(matrix: ScoreMatrix): number {
  let p = 0;
  for (let h = 0; h <= MAX_GOALS; h++) for (let a = 0; a < h; a++) p += matrix.grid[h][a];
  return p;
}
export function probabilityDraw(matrix: ScoreMatrix): number {
  let p = 0;
  for (let h = 0; h <= MAX_GOALS; h++) p += matrix.grid[h][h];
  return p;
}
export function probabilityAwayWin(matrix: ScoreMatrix): number {
  let p = 0;
  for (let h = 0; h <= MAX_GOALS; h++) for (let a = h + 1; a <= MAX_GOALS; a++) p += matrix.grid[h][a];
  return p;
}
export function probabilityOver(matrix: ScoreMatrix, line: number): number {
  let p = 0;
  for (let h = 0; h <= MAX_GOALS; h++)
    for (let a = 0; a <= MAX_GOALS; a++) if (h + a > line) p += matrix.grid[h][a];
  return p;
}
export function probabilityUnder(matrix: ScoreMatrix, line: number): number {
  return 1 - probabilityOver(matrix, line);
}
export function probabilityBttsYes(matrix: ScoreMatrix): number {
  let p = 0;
  for (let h = 1; h <= MAX_GOALS; h++) for (let a = 1; a <= MAX_GOALS; a++) p += matrix.grid[h][a];
  return p;
}
export function probabilityBttsNo(matrix: ScoreMatrix): number {
  return 1 - probabilityBttsYes(matrix);
}
