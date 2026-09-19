import type { HistoricalMatch, SportsDataProvider } from './types';

// Deterministic PRNG (mulberry32) so the synthetic dataset is stable across
// runs — useful for reproducible pipeline tests, never for real predictions.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poissonSample(rng: () => number, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

// Relative "true strength" assigned per synthetic team so the fake dataset
// still has learnable signal (a strong team beats a weak one more often),
// which is necessary to sanity-check the model pipeline end-to-end. This is
// NOT a real rating and must never be presented as one.
const SYNTHETIC_LEAGUES: Record<string, { teams: string[]; strength: Record<string, number> }> = {
  'Brasileirão Série A': {
    teams: ['Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Fluminense', 'Grêmio', 'Internacional', 'Botafogo'],
    strength: {
      Flamengo: 1.35,
      Palmeiras: 1.3,
      Corinthians: 1.05,
      'São Paulo': 1.1,
      Fluminense: 1.0,
      Grêmio: 0.95,
      Internacional: 1.0,
      Botafogo: 1.15
    }
  },
  'La Liga': {
    teams: ['Real Madrid', 'Sevilla', 'Barcelona', 'Atlético Madrid', 'Villarreal', 'Real Sociedad'],
    strength: { 'Real Madrid': 1.5, Sevilla: 0.9, Barcelona: 1.45, 'Atlético Madrid': 1.25, Villarreal: 1.0, 'Real Sociedad': 1.05 }
  },
  'Premier League': {
    teams: ['Manchester City', 'Everton', 'Liverpool', 'Arsenal', 'Chelsea', 'Newcastle'],
    strength: { 'Manchester City': 1.55, Everton: 0.85, Liverpool: 1.4, Arsenal: 1.35, Chelsea: 1.1, Newcastle: 1.05 }
  },
  'Serie A (Itália)': {
    teams: ['Inter de Milão', 'Roma', 'Milan', 'Juventus', 'Napoli', 'Atalanta'],
    strength: { 'Inter de Milão': 1.35, Roma: 1.05, Milan: 1.2, Juventus: 1.15, Napoli: 1.1, Atalanta: 1.15 }
  },
  Bundesliga: {
    teams: ['Bayern de Munique', 'Stuttgart', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen', 'Union Berlin'],
    strength: { 'Bayern de Munique': 1.6, Stuttgart: 1.1, 'Borussia Dortmund': 1.2, 'RB Leipzig': 1.15, 'Bayer Leverkusen': 1.25, 'Union Berlin': 0.9 }
  }
};

export class DemoSportsDataProvider implements SportsDataProvider {
  name = 'demo-sportsdata';
  synthetic = true;

  async fetchHistoricalMatches(league: string, asOf: Date, lookbackDays: number): Promise<HistoricalMatch[]> {
    const config = SYNTHETIC_LEAGUES[league];
    if (!config) return [];

    const rng = mulberry32(hashString(league));
    const matches: HistoricalMatch[] = [];
    const roundsNeeded = Math.max(6, Math.ceil((lookbackDays / 7) * 1.5)); // ~1.5 fixtures/team/week

    const teams = config.teams;
    let cursorDaysAgo = 3; // most recent synthetic match a few days before "today"

    for (let round = 0; round < roundsNeeded; round++) {
      const shuffled = [...teams].sort(() => rng() - 0.5);
      for (let i = 0; i + 1 < shuffled.length; i += 2) {
        const home = shuffled[i];
        const away = shuffled[i + 1];
        const homeStrength = config.strength[home] ?? 1;
        const awayStrength = config.strength[away] ?? 1;

        const homeLambda = 1.35 * homeStrength * (1 / awayStrength);
        const awayLambda = 1.0 * awayStrength * (1 / homeStrength);

        const matchDate = new Date(asOf.getTime() - cursorDaysAgo * 24 * 60 * 60 * 1000);
        if (matchDate.getTime() >= asOf.getTime() - lookbackDays * 24 * 60 * 60 * 1000) {
          matches.push({
            date: matchDate.toISOString(),
            league,
            homeTeam: home,
            awayTeam: away,
            homeGoals: poissonSample(rng, homeLambda),
            awayGoals: poissonSample(rng, awayLambda)
          });
        }
        cursorDaysAgo += 3;
      }
    }

    return matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
