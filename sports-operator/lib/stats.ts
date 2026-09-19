import type { EntryRecord } from './types';

export interface BankrollStats {
  totalEntries: number;
  settledEntries: number;
  wins: number;
  losses: number;
  voids: number;
  accumulatedProfit: number;
  accumulatedLoss: number;
  netResult: number;
  roi: number; // net result / total staked on settled entries
  yield: number; // same base as ROI in this simplified model, kept separate for clarity in UI
  hitRate: number; // wins / (wins + losses)
  maxDrawdown: number;
}

export function computeStats(entries: EntryRecord[]): BankrollStats {
  const settled = entries.filter((e) => e.status !== 'pending');
  const wins = settled.filter((e) => e.status === 'win').length;
  const losses = settled.filter((e) => e.status === 'loss').length;
  const voids = settled.filter((e) => e.status === 'void').length;

  const totalStaked = settled.reduce((acc, e) => acc + e.stake, 0);
  const accumulatedProfit = settled.reduce((acc, e) => acc + Math.max(0, e.profitLoss ?? 0), 0);
  const accumulatedLoss = settled.reduce((acc, e) => acc + Math.min(0, e.profitLoss ?? 0), 0);
  const netResult = accumulatedProfit + accumulatedLoss;

  const roi = totalStaked > 0 ? netResult / totalStaked : 0;
  const decided = wins + losses;
  const hitRate = decided > 0 ? wins / decided : 0;

  // Drawdown computed over chronological cumulative result curve.
  const chronological = [...settled].sort(
    (a, b) => new Date(a.settledAt ?? a.createdAt).getTime() - new Date(b.settledAt ?? b.createdAt).getTime()
  );
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const e of chronological) {
    cumulative += e.profitLoss ?? 0;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
  }

  return {
    totalEntries: entries.length,
    settledEntries: settled.length,
    wins,
    losses,
    voids,
    accumulatedProfit: +accumulatedProfit.toFixed(2),
    accumulatedLoss: +accumulatedLoss.toFixed(2),
    netResult: +netResult.toFixed(2),
    roi: +roi.toFixed(4),
    yield: +roi.toFixed(4),
    hitRate: +hitRate.toFixed(4),
    maxDrawdown: +maxDrawdown.toFixed(2)
  };
}
