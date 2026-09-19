/* eslint-disable no-console */
// Runs the backtest pipeline end-to-end against SYNTHETIC data only.
// This validates the plumbing (walk-forward, no leakage, calibration,
// ROI simulation) — it is NOT evidence of real-world model performance.
// Usage: npm run backtest:demo
import { DemoSportsDataProvider } from '../lib/providers/sportsdata/demoSportsDataProvider';
import { poissonPmf } from '../lib/analysis/models/footballV1';
import { runBacktest, type HistoricalOddsQuote } from '../lib/analysis/backtest/backtest';
import { computeCalibrationCurve } from '../lib/analysis/calibration/calibration';
import type { UserSettings } from '../lib/types';
import type { HistoricalMatch } from '../lib/providers/sportsdata/types';

// Mirrors the hidden "true strength" table used by DemoSportsDataProvider to
// generate synthetic results, so we can derive plausible historical ODDS
// from the same strengths WITHOUT looking at the actual final score of the
// match being priced (that would be leakage). This duplication is
// intentional and confined to this demo-only script.
const STRENGTH: Record<string, number> = {
  Flamengo: 1.35, Palmeiras: 1.3, Corinthians: 1.05, 'São Paulo': 1.1, Fluminense: 1.0, Grêmio: 0.95, Internacional: 1.0, Botafogo: 1.15,
  'Real Madrid': 1.5, Sevilla: 0.9, Barcelona: 1.45, 'Atlético Madrid': 1.25, Villarreal: 1.0, 'Real Sociedad': 1.05,
  'Manchester City': 1.55, Everton: 0.85, Liverpool: 1.4, Arsenal: 1.35, Chelsea: 1.1, Newcastle: 1.05,
  'Inter de Milão': 1.35, Roma: 1.05, Milan: 1.2, Juventus: 1.15, Napoli: 1.1, Atalanta: 1.15,
  'Bayern de Munique': 1.6, Stuttgart: 1.1, 'Borussia Dortmund': 1.2, 'RB Leipzig': 1.15, 'Bayer Leverkusen': 1.25, 'Union Berlin': 0.9
};

function trueMatchProbabilities(home: string, away: string): { home: number; draw: number; away: number } {
  const homeLambda = 1.35 * (STRENGTH[home] ?? 1) * (1 / (STRENGTH[away] ?? 1));
  const awayLambda = 1.0 * (STRENGTH[away] ?? 1) * (1 / (STRENGTH[home] ?? 1));

  let pHome = 0, pDraw = 0, pAway = 0;
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p = poissonPmf(h, homeLambda) * poissonPmf(a, awayLambda);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  const sum = pHome + pDraw + pAway;
  return { home: pHome / sum, draw: pDraw / sum, away: pAway / sum };
}

function toOddsWithVig(probabilities: { home: number; draw: number; away: number }, vig = 0.06): { home: number; draw: number; away: number } {
  const inflate = 1 + vig;
  return {
    home: +(1 / (probabilities.home * inflate)).toFixed(2),
    draw: +(1 / (probabilities.draw * inflate)).toFixed(2),
    away: +(1 / (probabilities.away * inflate)).toFixed(2)
  };
}

async function main() {
  const provider = new DemoSportsDataProvider();
  const leagues = ['Brasileirão Série A', 'La Liga', 'Premier League', 'Serie A (Itália)', 'Bundesliga'];
  const asOf = new Date();
  const lookbackDays = 240;

  let allMatches: HistoricalMatch[] = [];
  for (const league of leagues) {
    const matches = await provider.fetchHistoricalMatches(league, asOf, lookbackDays);
    allMatches = allMatches.concat(matches);
  }

  const oddsQuotes: HistoricalOddsQuote[] = allMatches.map((m) => {
    const probs = trueMatchProbabilities(m.homeTeam, m.awayTeam);
    const odds = toOddsWithVig(probs);
    return [
      { date: m.date, league: m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, marketKey: 'h2h' as const, marketLabel: 'Resultado Final (1X2)', outcomeName: m.homeTeam, price: odds.home, bookmaker: 'SyntheticBook' },
      { date: m.date, league: m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, marketKey: 'h2h' as const, marketLabel: 'Resultado Final (1X2)', outcomeName: 'Empate', price: odds.draw, bookmaker: 'SyntheticBook' },
      { date: m.date, league: m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, marketKey: 'h2h' as const, marketLabel: 'Resultado Final (1X2)', outcomeName: m.awayTeam, price: odds.away, bookmaker: 'SyntheticBook' }
    ];
  }).flat();

  const settings: UserSettings = {
    bankroll: 1000,
    stakePercent: 2,
    maxStake: 50,
    profitTarget: 10,
    minProbability: 0.4,
    minOdd: 1.3,
    maxOdd: 6,
    maxLegsMultiple: 2
  };

  const report = runBacktest(allMatches, oddsQuotes, settings, { synthetic: true });

  console.log('=== BACKTEST (SYNTHETIC DATA — pipeline validation only, NOT real performance) ===');
  console.log('Model version:', report.modelVersion);
  console.log('Matches loaded:', allMatches.length);
  console.log('Bet records evaluated:', report.recordCount);
  console.log('Brier score:', report.brierScore);
  console.log('Log loss:', report.logLoss);
  console.log('Accuracy (>=0.5 threshold):', report.accuracy);
  console.log('Total staked:', report.totalStaked);
  console.log('Net P/L:', report.netProfitLoss);
  console.log('ROI:', report.roi);
  console.log('\nCalibration curve:');
  console.table(computeCalibrationCurve(report.calibrationSamples));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
