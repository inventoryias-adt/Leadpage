import type { MarketKey, UserSettings } from '../../types';
import type { HistoricalMatch } from '../../providers/sportsdata/types';
import { computeLeagueRatings, predictMatch, MODEL_VERSION } from '../models/footballV1';
import { devig, impliedProbability, modelProbabilityFor, resolveActualOutcome, computeStake } from '../markets';
import type { CalibrationSample } from '../calibration/calibration';
import { brierScore, logLoss, accuracy } from '../calibration/calibration';

// A historical odds quote for one outcome of one finished match — needed
// to simulate what a bet would have paid. This project has NO source of
// historical odds today (the odds provider only returns current/upcoming
// prices); callers must supply this externally (e.g. a CSV export from a
// paid historical-odds provider) until one is integrated.
export interface HistoricalOddsQuote {
  date: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  marketKey: MarketKey;
  marketLabel: string;
  outcomeName: string;
  price: number;
  bookmaker: string;
}

export interface BacktestRecord {
  date: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  marketLabel: string;
  outcomeName: string;
  odd: number;
  marketProbability: number;
  modelProbability: number;
  actualOutcome: 0 | 1;
  edge: number;
  expectedValue: number;
  stake: number;
  profitLoss: number;
  modelVersion: string;
}

export interface BacktestReport {
  modelVersion: string;
  synthetic: boolean;
  recordCount: number;
  records: BacktestRecord[];
  calibrationSamples: CalibrationSample[];
  brierScore: number | null;
  logLoss: number | null;
  accuracy: number | null;
  totalStaked: number;
  netProfitLoss: number;
  roi: number | null;
}

function matchKey(league: string, home: string, away: string, date: string): string {
  return `${league}|${home}|${away}|${date.slice(0, 10)}`;
}

/**
 * Walk-forward backtest: for every historical match, ratings are computed
 * using ONLY matches strictly before that match's date (enforced by
 * computeLeagueRatings' own `asOf` filter — see the data-leakage test in
 * lib/analysis/__tests__/backtest.test.ts). No match ever "sees" its own
 * result or any future match's result while being rated.
 *
 * `allMatches` must be the full historical pool (used to build ratings at
 * each point in time); `oddsQuotes` supplies the prices actually available
 * for each match/market/outcome — without it, this can only report
 * calibration metrics (Brier/log-loss/accuracy), not ROI/EV, since there
 * is nothing to stake against.
 */
export function runBacktest(
  allMatches: HistoricalMatch[],
  oddsQuotes: HistoricalOddsQuote[],
  settings: UserSettings,
  options: { synthetic: boolean }
): BacktestReport {
  const sortedMatches = [...allMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const oddsByMatch = new Map<string, HistoricalOddsQuote[]>();
  for (const q of oddsQuotes) {
    const key = matchKey(q.league, q.homeTeam, q.awayTeam, q.date);
    const list = oddsByMatch.get(key) ?? [];
    list.push(q);
    oddsByMatch.set(key, list);
  }

  const records: BacktestRecord[] = [];
  const calibrationSamples: CalibrationSample[] = [];

  for (const match of sortedMatches) {
    const asOf = new Date(match.date);
    // Leakage guard: computeLeagueRatings only considers matches with
    // date < asOf, so `match` itself and every later match are invisible
    // to the rating computation below.
    const ratings = computeLeagueRatings(allMatches, asOf, match.league);
    if (!ratings) continue;

    const matrix = predictMatch(ratings, match.homeTeam, match.awayTeam);
    if (!matrix || !matrix.dataQuality.sufficientSample) continue;

    const key = matchKey(match.league, match.homeTeam, match.awayTeam, match.date);
    const quotesForMatch = oddsByMatch.get(key) ?? [];
    if (quotesForMatch.length === 0) continue;

    const byMarket = new Map<MarketKey, HistoricalOddsQuote[]>();
    for (const q of quotesForMatch) {
      const list = byMarket.get(q.marketKey) ?? [];
      list.push(q);
      byMarket.set(q.marketKey, list);
    }

    for (const [marketKeyValue, quotes] of byMarket) {
      const fairProbs = devig(quotes);

      quotes.forEach((quote, idx) => {
        const modelProbability = modelProbabilityFor(matrix, marketKeyValue, quote.marketLabel, quote.outcomeName, match.homeTeam, match.awayTeam);
        if (modelProbability === null) return;

        const actualOutcome = resolveActualOutcome(
          marketKeyValue,
          quote.marketLabel,
          quote.outcomeName,
          match.homeTeam,
          match.awayTeam,
          match.homeGoals,
          match.awayGoals
        );
        if (actualOutcome === null) return;

        const marketProbability = fairProbs[idx];
        const implied = impliedProbability(quote.price);
        const edge = modelProbability - implied;
        const expectedValue = modelProbability * (quote.price - 1) - (1 - modelProbability);

        const { stake } = computeStake(settings, quote.price);
        const wouldBet = edge > 0 && modelProbability >= settings.minProbability && quote.price >= settings.minOdd && quote.price <= settings.maxOdd;
        const profitLoss = wouldBet ? (actualOutcome === 1 ? +(stake * (quote.price - 1)).toFixed(2) : -stake) : 0;

        records.push({
          date: match.date,
          league: match.league,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          marketLabel: quote.marketLabel,
          outcomeName: quote.outcomeName,
          odd: quote.price,
          marketProbability: +marketProbability.toFixed(4),
          modelProbability: +modelProbability.toFixed(4),
          actualOutcome,
          edge: +edge.toFixed(4),
          expectedValue: +expectedValue.toFixed(4),
          stake: wouldBet ? stake : 0,
          profitLoss,
          modelVersion: MODEL_VERSION
        });

        calibrationSamples.push({ predictedProbability: modelProbability, outcome: actualOutcome });
      });
    }
  }

  const staked = records.reduce((a, r) => a + r.stake, 0);
  const net = records.reduce((a, r) => a + r.profitLoss, 0);

  return {
    modelVersion: MODEL_VERSION,
    synthetic: options.synthetic,
    recordCount: records.length,
    records,
    calibrationSamples,
    brierScore: brierScore(calibrationSamples),
    logLoss: logLoss(calibrationSamples),
    accuracy: accuracy(calibrationSamples),
    totalStaked: +staked.toFixed(2),
    netProfitLoss: +net.toFixed(2),
    roi: staked > 0 ? +(net / staked).toFixed(4) : null
  };
}
