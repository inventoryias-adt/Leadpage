export type MarketKey = 'h2h' | 'draw_no_bet' | 'double_chance' | 'over_under_2_5' | 'btts';

export interface OddsOutcome {
  name: string; // e.g. "Home", "Draw", "Away", "Over 2.5", "Yes"
  price: number; // decimal odds
}

export interface OddsMarket {
  marketKey: MarketKey;
  marketLabel: string;
  bookmaker: string;
  outcomes: OddsOutcome[];
}

export interface Game {
  id: string;
  league: string;
  commenceTime: string; // ISO string
  homeTeam: string;
  awayTeam: string;
  markets: OddsMarket[];
}

export interface GamesResponse {
  demo: boolean;
  provider: string;
  fetchedAt: string;
  games: Game[];
  error?: string;
}

export type SelectionType = 'simple' | 'multiple' | 'no_bet';

export interface AnalyzedSelection {
  gameId: string;
  league: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  marketLabel: string;
  outcomeName: string;
  bookmaker: string;
  odd: number;
  impliedProbability: number;
  modelProbability: number;
  edge: number;
  expectedValue: number; // per 1 unit staked
  score: number;
}

export interface Opportunity {
  id: string;
  type: SelectionType;
  selections: AnalyzedSelection[];
  combinedOdd: number;
  impliedProbability: number;
  modelProbability: number;
  edge: number;
  expectedValue: number;
  score: number;
  suggestedStake: number;
  potentialReturn: number;
  potentialProfit: number;
  confidence: 'alta' | 'media' | 'baixa';
  reasonsRejected?: string[];
}

export interface UserSettings {
  bankroll: number;
  stakePercent: number; // % of bankroll per entry
  maxStake: number; // absolute cap
  profitTarget: number; // % target, informational only
  minProbability: number; // 0-1, minimum MODEL probability filter
  minOdd: number;
  maxOdd: number;
  maxLegsMultiple: number; // 2 or 3
}

export type EntryStatus = 'pending' | 'win' | 'loss' | 'void';

export interface EntryRecord {
  id: string;
  createdAt: string;
  type: SelectionType;
  description: string;
  odd: number;
  impliedProbability: number;
  modelProbability: number;
  edge: number;
  expectedValue: number;
  score: number;
  stake: number;
  potentialReturn: number;
  potentialProfit: number;
  status: EntryStatus;
  settledAt?: string | null;
  profitLoss?: number | null;
  raw: string; // JSON snapshot of the Opportunity for audit / analysis modal
}
