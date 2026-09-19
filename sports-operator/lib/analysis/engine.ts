import type { AnalyzedSelection, DataQuality, Game, MarketKey, NoBetReport, Opportunity, UserSettings } from '../types';
import type { SportsDataProvider, HistoricalMatch } from '../providers/sportsdata/types';
import { getSportsDataProvider } from '../providers/sportsdata';
import { computeLeagueRatings, predictMatch, MODEL_VERSION, type LeagueRatings, type ScoreMatrix } from './models/footballV1';
import { computeScore, computeConfidence } from './scoring/score';
import type { CalibrationSample } from './calibration/calibration';
import { devig, findRatingKey, impliedProbability, modelProbabilityFor, computeStake } from './markets';

// How far back to pull historical results when building team ratings.
// ~8 months gives roughly a season's worth of matches for major European
// leagues without over-weighting stale form.
const LOOKBACK_DAYS = 240;

interface EngineDeps {
  sportsDataProvider?: SportsDataProvider;
  calibrationSamples?: CalibrationSample[];
  asOf?: Date;
}

async function loadRatingsByLeague(
  games: Game[],
  provider: SportsDataProvider,
  asOf: Date
): Promise<Map<string, LeagueRatings | null>> {
  const leagues = Array.from(new Set(games.map((g) => g.league)));
  const entries = await Promise.all(
    leagues.map(async (league) => {
      try {
        const matches: HistoricalMatch[] = await provider.fetchHistoricalMatches(league, asOf, LOOKBACK_DAYS);
        return [league, computeLeagueRatings(matches, asOf, league)] as const;
      } catch (err) {
        console.warn(`[engine] failed to load historical data for league "${league}":`, err);
        return [league, null] as const;
      }
    })
  );
  return new Map(entries);
}

function buildDataQuality(matrix: ScoreMatrix | null, synthetic: boolean): DataQuality {
  return {
    modelVersion: MODEL_VERSION,
    sufficientSample: matrix?.dataQuality.sufficientSample ?? false,
    homeMatchesUsed: matrix?.dataQuality.homeMatchesUsed ?? 0,
    awayMatchesUsed: matrix?.dataQuality.awayMatchesUsed ?? 0,
    synthetic
  };
}

function analyzeGame(
  game: Game,
  ratings: LeagueRatings | null,
  synthetic: boolean,
  calibrationSamples: CalibrationSample[]
): { selections: AnalyzedSelection[]; noBetReasons: string[] } {
  const noBetReasons: string[] = [];

  if (!ratings) {
    return { selections: [], noBetReasons: [`Sem histórico suficiente para a liga "${game.league}".`] };
  }

  const homeKey = findRatingKey(ratings, game.homeTeam);
  const awayKey = findRatingKey(ratings, game.awayTeam);
  if (!homeKey || !awayKey) {
    return {
      selections: [],
      noBetReasons: [`Não foi possível casar "${game.homeTeam}" x "${game.awayTeam}" com o histórico da liga.`]
    };
  }

  const matrix = predictMatch(ratings, homeKey, awayKey);
  if (!matrix) {
    return { selections: [], noBetReasons: ['Falha ao gerar a matriz de placares do modelo.'] };
  }

  if (!matrix.dataQuality.sufficientSample) {
    noBetReasons.push(
      `Amostra insuficiente (mandante: ${matrix.dataQuality.homeMatchesUsed} jogos, visitante: ${matrix.dataQuality.awayMatchesUsed} jogos).`
    );
  }

  const dataQuality = buildDataQuality(matrix, synthetic);
  const selections: AnalyzedSelection[] = [];
  const marketKeys: MarketKey[] = ['h2h', 'over_under_2_5', 'btts'];

  for (const key of marketKeys) {
    const marketsOfKind = game.markets.filter((m) => m.marketKey === key);
    if (marketsOfKind.length === 0) continue;

    const reference = marketsOfKind[0];
    const fairProbs = devig(reference.outcomes);

    for (const outcomeIndex of reference.outcomes.keys()) {
      const outcomeName = reference.outcomes[outcomeIndex].name;
      const marketProbability = fairProbs[outcomeIndex];

      const modelProbability = modelProbabilityFor(matrix, key, reference.marketLabel, outcomeName, game.homeTeam, game.awayTeam);
      if (modelProbability === null) continue;

      let bestOdd = -Infinity;
      let bestBookmaker = '';
      for (const market of marketsOfKind) {
        const outcome = market.outcomes.find((o) => o.name === outcomeName);
        if (outcome && outcome.price > bestOdd) {
          bestOdd = outcome.price;
          bestBookmaker = market.bookmaker;
        }
      }
      if (!Number.isFinite(bestOdd) || bestOdd <= 1) continue;

      const implied = impliedProbability(bestOdd);
      const edge = modelProbability - implied;
      const expectedValue = modelProbability * (bestOdd - 1) - (1 - modelProbability);

      const score = computeScore({ modelProbability, marketProbability, edge, expectedValue, dataQuality, calibrationSamples });

      selections.push({
        gameId: game.id,
        league: game.league,
        commenceTime: game.commenceTime,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        marketKey: key,
        marketLabel: reference.marketLabel,
        outcomeName,
        bookmaker: bestBookmaker,
        odd: +bestOdd.toFixed(2),
        impliedProbability: +implied.toFixed(4),
        marketProbability: +marketProbability.toFixed(4),
        modelProbability: +modelProbability.toFixed(4),
        edge: +edge.toFixed(4),
        expectedValue: +expectedValue.toFixed(4),
        score,
        modelVersion: MODEL_VERSION,
        dataQuality
      });
    }
  }

  return { selections, noBetReasons };
}

function passesFilters(sel: AnalyzedSelection, settings: UserSettings): boolean {
  return (
    sel.modelProbability >= settings.minProbability &&
    sel.odd >= settings.minOdd &&
    sel.odd <= settings.maxOdd &&
    sel.edge > 0 &&
    sel.dataQuality.sufficientSample
  );
}

function combinedDataQuality(selections: AnalyzedSelection[]): DataQuality {
  return {
    modelVersion: MODEL_VERSION,
    sufficientSample: selections.every((s) => s.dataQuality.sufficientSample),
    homeMatchesUsed: Math.min(...selections.map((s) => s.dataQuality.homeMatchesUsed)),
    awayMatchesUsed: Math.min(...selections.map((s) => s.dataQuality.awayMatchesUsed)),
    synthetic: selections.some((s) => s.dataQuality.synthetic)
  };
}

function hasCorrelatedLegs(selections: AnalyzedSelection[]): boolean {
  const gameIds = new Set(selections.map((s) => s.gameId));
  return gameIds.size !== selections.length;
}

function buildSimpleOpportunity(sel: AnalyzedSelection, settings: UserSettings, calibrationSamples: CalibrationSample[]): Opportunity {
  const { stake, potentialReturn, potentialProfit } = computeStake(settings, sel.odd);
  const confidence = computeConfidence({
    modelProbability: sel.modelProbability,
    edge: sel.edge,
    dataQuality: sel.dataQuality,
    calibrationSamples,
    marketProbability: sel.marketProbability
  });

  return {
    id: `simple-${sel.gameId}-${sel.marketLabel}-${sel.outcomeName}`.replace(/\s+/g, '_'),
    type: 'simple',
    selections: [sel],
    combinedOdd: sel.odd,
    impliedProbability: sel.impliedProbability,
    marketProbability: sel.marketProbability,
    modelProbability: sel.modelProbability,
    edge: sel.edge,
    expectedValue: sel.expectedValue,
    score: sel.score,
    suggestedStake: stake,
    potentialReturn,
    potentialProfit,
    confidence,
    modelVersion: MODEL_VERSION
  };
}

function buildMultiple(legs: AnalyzedSelection[], settings: UserSettings, calibrationSamples: CalibrationSample[]): Opportunity | null {
  if (legs.length < 2) return null;
  if (hasCorrelatedLegs(legs)) return null; // never recommend a mispriced correlated multiple

  const combinedOdd = legs.reduce((acc, l) => acc * l.odd, 1);
  const combinedImplied = legs.reduce((acc, l) => acc * l.impliedProbability, 1);
  const combinedMarket = legs.reduce((acc, l) => acc * l.marketProbability, 1);
  // Independence assumption is only valid because legs come from different
  // games (enforced above by hasCorrelatedLegs).
  const combinedModel = legs.reduce((acc, l) => acc * l.modelProbability, 1);
  const edge = combinedModel - combinedImplied;
  const expectedValue = combinedModel * (combinedOdd - 1) - (1 - combinedModel);

  if (edge <= 0) return null; // don't recommend negative-edge multiples

  const dataQuality = combinedDataQuality(legs);
  const score = computeScore({ modelProbability: combinedModel, marketProbability: combinedMarket, edge, expectedValue, dataQuality, calibrationSamples });
  const confidence = computeConfidence({ modelProbability: combinedModel, edge, dataQuality, calibrationSamples, marketProbability: combinedMarket });
  const { stake, potentialReturn, potentialProfit } = computeStake(settings, combinedOdd);

  return {
    id: `multiple-${legs.map((l) => l.gameId).join('-')}`,
    type: 'multiple',
    selections: legs,
    combinedOdd: +combinedOdd.toFixed(2),
    impliedProbability: +combinedImplied.toFixed(4),
    marketProbability: +combinedMarket.toFixed(4),
    modelProbability: +combinedModel.toFixed(4),
    edge: +edge.toFixed(4),
    expectedValue: +expectedValue.toFixed(4),
    score,
    suggestedStake: stake,
    potentialReturn,
    potentialProfit,
    confidence,
    modelVersion: MODEL_VERSION
  };
}

export interface EngineResult {
  opportunities: Opportunity[];
  noBets: NoBetReport[];
}

export async function buildOpportunities(games: Game[], settings: UserSettings, deps: EngineDeps = {}): Promise<EngineResult> {
  const provider = deps.sportsDataProvider ?? getSportsDataProvider();
  const calibrationSamples = deps.calibrationSamples ?? [];
  const asOf = deps.asOf ?? new Date();

  const ratingsByLeague = await loadRatingsByLeague(games, provider, asOf);

  const allSelections: AnalyzedSelection[] = [];
  const noBets: NoBetReport[] = [];

  for (const game of games) {
    const ratings = ratingsByLeague.get(game.league) ?? null;
    const { selections, noBetReasons } = analyzeGame(game, ratings, provider.synthetic, calibrationSamples);

    const qualifying = selections.filter((s) => passesFilters(s, settings));
    allSelections.push(...qualifying);

    const rejectedReasons = [
      ...noBetReasons,
      ...selections
        .filter((s) => !passesFilters(s, settings))
        .map((s) => {
          if (s.edge <= 0) return `${s.marketLabel} (${s.outcomeName}): edge não positivo.`;
          if (!s.dataQuality.sufficientSample) return `${s.marketLabel} (${s.outcomeName}): amostra insuficiente.`;
          if (s.odd < settings.minOdd || s.odd > settings.maxOdd) return `${s.marketLabel} (${s.outcomeName}): odd fora da faixa configurada.`;
          return `${s.marketLabel} (${s.outcomeName}): abaixo da probabilidade mínima configurada.`;
        })
    ];

    if (qualifying.length === 0) {
      noBets.push({
        gameId: game.id,
        league: game.league,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        reasons: rejectedReasons.length > 0 ? rejectedReasons : ['Nenhuma seleção qualificada.']
      });
    }
  }

  const opportunities: Opportunity[] = [];

  for (const sel of allSelections) {
    opportunities.push(buildSimpleOpportunity(sel, settings, calibrationSamples));
  }

  const sortedByScore = [...allSelections].sort((a, b) => b.score - a.score);
  const legCounts = settings.maxLegsMultiple >= 3 ? [2, 3] : [2];

  for (const legCount of legCounts) {
    const usedGameIds = new Set<string>();
    const candidateLegs: AnalyzedSelection[] = [];
    for (const sel of sortedByScore) {
      if (usedGameIds.has(sel.gameId)) continue;
      candidateLegs.push(sel);
      usedGameIds.add(sel.gameId);
      if (candidateLegs.length === legCount) break;
    }
    const multi = buildMultiple(candidateLegs, settings, calibrationSamples);
    if (multi) opportunities.push(multi);
  }

  opportunities.sort((a, b) => b.score - a.score);

  return { opportunities, noBets };
}
