import type {
  AnalyzedSelection,
  Game,
  MarketKey,
  Opportunity,
  OddsMarket,
  SelectionType,
  UserSettings
} from '../types';

// Configurable analysis engine. Model probability here is a transparent,
// odds-derived heuristic (de-vigged implied probability adjusted by a small
// league/market confidence factor) — NOT a black-box ML prediction. It is
// explicitly labeled "MODEL" everywhere in the UI, distinct from the
// bookmaker's implied probability. TODO (V2): plug in a real statistical
// model (Poisson/xG based) behind this same interface.

function impliedProbability(odd: number): number {
  return 1 / odd;
}

// Remove bookmaker margin (overround) from a full market's outcomes so the
// probabilities sum to 1 — this is the "fair" implied probability.
function devig(outcomes: { price: number }[]): number[] {
  const raw = outcomes.map((o) => impliedProbability(o.price));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((p) => p / sum);
}

interface ModelConfig {
  // Confidence pull toward the de-vigged market probability (0-1).
  // 1 = trust market fully. Lower values shrink toward a neutral prior,
  // simulating a cautious independent model instead of just echoing odds.
  marketTrust: number;
}

const DEFAULT_MODEL_CONFIG: ModelConfig = { marketTrust: 0.92 };

function estimateModelProbability(fairProb: number, config: ModelConfig = DEFAULT_MODEL_CONFIG): number {
  const neutral = 1 / 3; // conservative neutral prior for a 3-way-ish market
  const blended = fairProb * config.marketTrust + neutral * (1 - config.marketTrust);
  return Math.min(0.98, Math.max(0.02, blended));
}

function scoreOf(edge: number, modelProbability: number, expectedValue: number): number {
  // Weighted composite: rewards positive EV and edge, penalizes very low
  // probability picks (higher variance) even if EV looks attractive.
  const evComponent = Math.max(0, expectedValue) * 40;
  const edgeComponent = Math.max(0, edge) * 100;
  const probComponent = modelProbability * 20;
  return +(evComponent + edgeComponent + probComponent).toFixed(2);
}

function bestMarketsByOutcome(markets: OddsMarket[], marketKey: MarketKey): OddsMarket[] {
  return markets.filter((m) => m.marketKey === marketKey);
}

export function analyzeGame(game: Game): AnalyzedSelection[] {
  const selections: AnalyzedSelection[] = [];
  const marketKeys: MarketKey[] = ['h2h', 'over_under_2_5', 'btts'];

  for (const key of marketKeys) {
    const marketsOfKind = bestMarketsByOutcome(game.markets, key);
    if (marketsOfKind.length === 0) continue;

    // Use the first market instance to define fair probabilities (outcome
    // structure is shared across bookmakers for the same market key).
    const reference = marketsOfKind[0];
    const fairProbs = devig(reference.outcomes);

    for (const outcomeIndex of reference.outcomes.keys()) {
      const outcomeName = reference.outcomes[outcomeIndex].name;
      const fairProb = fairProbs[outcomeIndex];
      const modelProbability = estimateModelProbability(fairProb);

      // Pick the best (highest) odd across all bookmakers offering this market+outcome.
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

      selections.push({
        gameId: game.id,
        league: game.league,
        commenceTime: game.commenceTime,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        marketLabel: reference.marketLabel,
        outcomeName,
        bookmaker: bestBookmaker,
        odd: +bestOdd.toFixed(2),
        impliedProbability: +implied.toFixed(4),
        modelProbability: +modelProbability.toFixed(4),
        edge: +edge.toFixed(4),
        expectedValue: +expectedValue.toFixed(4),
        score: scoreOf(edge, modelProbability, expectedValue)
      });
    }
  }

  return selections;
}

function passesFilters(sel: AnalyzedSelection, settings: UserSettings): boolean {
  return (
    sel.modelProbability >= settings.minProbability &&
    sel.odd >= settings.minOdd &&
    sel.odd <= settings.maxOdd &&
    sel.edge > 0
  );
}

function computeStake(settings: UserSettings, odd: number): {
  stake: number;
  potentialReturn: number;
  potentialProfit: number;
} {
  const rawStake = (settings.bankroll * settings.stakePercent) / 100;
  const stake = +Math.min(rawStake, settings.maxStake).toFixed(2);
  const potentialReturn = +(stake * odd).toFixed(2);
  const potentialProfit = +(potentialReturn - stake).toFixed(2);
  return { stake, potentialReturn, potentialProfit };
}

function confidenceOf(modelProbability: number, edge: number): 'alta' | 'media' | 'baixa' {
  if (modelProbability >= 0.65 && edge >= 0.05) return 'alta';
  if (modelProbability >= 0.5 && edge >= 0.02) return 'media';
  return 'baixa';
}

// Correlation guard: selections from the SAME game are correlated by
// definition (e.g. "Home wins" and "Over 2.5" share the same match outcome
// space). We refuse to build a multiple from legs sharing a gameId, since
// naive probability multiplication would misprice it.
function hasCorrelatedLegs(selections: AnalyzedSelection[]): boolean {
  const gameIds = new Set(selections.map((s) => s.gameId));
  return gameIds.size !== selections.length;
}

function buildSimpleOpportunity(sel: AnalyzedSelection, settings: UserSettings): Opportunity {
  const { stake, potentialReturn, potentialProfit } = computeStake(settings, sel.odd);
  return {
    id: `simple-${sel.gameId}-${sel.marketLabel}-${sel.outcomeName}`.replace(/\s+/g, '_'),
    type: 'simple',
    selections: [sel],
    combinedOdd: sel.odd,
    impliedProbability: sel.impliedProbability,
    modelProbability: sel.modelProbability,
    edge: sel.edge,
    expectedValue: sel.expectedValue,
    score: sel.score,
    suggestedStake: stake,
    potentialReturn,
    potentialProfit,
    confidence: confidenceOf(sel.modelProbability, sel.edge)
  };
}

function buildMultiple(
  legs: AnalyzedSelection[],
  settings: UserSettings
): Opportunity | null {
  if (legs.length < 2) return null;
  if (hasCorrelatedLegs(legs)) return null; // never recommend a mispriced correlated multiple

  const combinedOdd = legs.reduce((acc, l) => acc * l.odd, 1);
  const combinedImplied = legs.reduce((acc, l) => acc * l.impliedProbability, 1);
  // Independence assumption is only valid because legs come from different
  // games (enforced above). Still treated conservatively via modelTrust.
  const combinedModel = legs.reduce((acc, l) => acc * l.modelProbability, 1);
  const edge = combinedModel - combinedImplied;
  const expectedValue = combinedModel * (combinedOdd - 1) - (1 - combinedModel);

  if (edge <= 0) return null; // don't recommend negative-edge multiples

  const score = scoreOf(edge, combinedModel, expectedValue);
  const { stake, potentialReturn, potentialProfit } = computeStake(settings, combinedOdd);

  return {
    id: `multiple-${legs.map((l) => l.gameId).join('-')}`,
    type: 'multiple',
    selections: legs,
    combinedOdd: +combinedOdd.toFixed(2),
    impliedProbability: +combinedImplied.toFixed(4),
    modelProbability: +combinedModel.toFixed(4),
    edge: +edge.toFixed(4),
    expectedValue: +expectedValue.toFixed(4),
    score,
    suggestedStake: stake,
    potentialReturn,
    potentialProfit,
    confidence: confidenceOf(combinedModel, edge)
  };
}

export function buildOpportunities(games: Game[], settings: UserSettings): Opportunity[] {
  const allSelections = games.flatMap(analyzeGame);
  const qualifying = allSelections.filter((s) => passesFilters(s, settings));

  const opportunities: Opportunity[] = [];

  // Simple entries: one per qualifying selection.
  for (const sel of qualifying) {
    opportunities.push(buildSimpleOpportunity(sel, settings));
  }

  // Multiples: only from top-scoring qualifying selections, different games,
  // capped at settings.maxLegsMultiple (2 or 3), never mixing correlated legs.
  const sortedByScore = [...qualifying].sort((a, b) => b.score - a.score);
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
    const multi = buildMultiple(candidateLegs, settings);
    if (multi) opportunities.push(multi);
  }

  return opportunities.sort((a, b) => b.score - a.score);
}

export function classifyType(op: Opportunity): SelectionType {
  return op.type;
}
