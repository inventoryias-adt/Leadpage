import { describe, it, expect } from 'vitest';
import { entriesToCalibrationSamples } from '../fromEntries';
import type { EntryRecord } from '../../../types';

function makeEntry(overrides: Partial<EntryRecord> & { modelVersion?: string }): EntryRecord {
  const { modelVersion = 'football-v1', ...rest } = overrides;
  return {
    id: 'e1',
    createdAt: '2024-01-01T00:00:00.000Z',
    type: 'simple',
    description: 'Test x Team',
    odd: 2,
    impliedProbability: 0.5,
    modelProbability: 0.6,
    edge: 0.1,
    expectedValue: 0.1,
    score: 50,
    stake: 2,
    potentialReturn: 4,
    potentialProfit: 2,
    status: 'pending',
    settledAt: null,
    profitLoss: null,
    raw: JSON.stringify({ modelVersion }),
    ...rest
  };
}

describe('entriesToCalibrationSamples (feedback loop)', () => {
  it('includes WIN entries as outcome=1 and LOSS entries as outcome=0', () => {
    const entries = [
      makeEntry({ status: 'win', modelProbability: 0.7 }),
      makeEntry({ status: 'loss', modelProbability: 0.6 })
    ];
    const samples = entriesToCalibrationSamples(entries, 'football-v1');
    expect(samples).toEqual([
      { predictedProbability: 0.7, outcome: 1 },
      { predictedProbability: 0.6, outcome: 0 }
    ]);
  });

  it('excludes PENDING and VOID entries (no known outcome signal)', () => {
    const entries = [makeEntry({ status: 'pending' }), makeEntry({ status: 'void' })];
    expect(entriesToCalibrationSamples(entries, 'football-v1')).toEqual([]);
  });

  it('excludes entries settled under a different model version', () => {
    const entries = [
      makeEntry({ status: 'win', modelVersion: 'football-v0-legacy' }),
      makeEntry({ status: 'win', modelVersion: 'football-v1' })
    ];
    const samples = entriesToCalibrationSamples(entries, 'football-v1');
    expect(samples.length).toBe(1);
  });

  it('does not throw on a malformed raw field, just skips that entry', () => {
    const entries = [makeEntry({ status: 'win', raw: 'not json' })];
    expect(() => entriesToCalibrationSamples(entries, 'football-v1')).not.toThrow();
    expect(entriesToCalibrationSamples(entries, 'football-v1')).toEqual([]);
  });
});
