import { describe, it, expect } from 'vitest';
import { computeConfidence, computeScore } from '../score';
import type { DataQuality } from '../../../types';

function dq(overrides: Partial<DataQuality> = {}): DataQuality {
  return { modelVersion: 'football-v1', sufficientSample: true, homeMatchesUsed: 20, awayMatchesUsed: 20, synthetic: false, ...overrides };
}

describe('computeConfidence', () => {
  it('never returns "alta" for a 95% model probability alone, without calibration evidence', () => {
    const confidence = computeConfidence({
      modelProbability: 0.95,
      edge: 0.2,
      dataQuality: dq(),
      calibrationSamples: [], // no calibration evidence yet
      marketProbability: 0.7
    });
    expect(confidence).not.toBe('alta');
  });

  it('returns "baixa" when the data sample is insufficient, regardless of edge', () => {
    const confidence = computeConfidence({
      modelProbability: 0.7,
      edge: 0.1,
      dataQuality: dq({ sufficientSample: false }),
      calibrationSamples: [],
      marketProbability: 0.5
    });
    expect(confidence).toBe('baixa');
  });

  it('caps confidence at "media" for synthetic/demo data even with a large edge', () => {
    const confidence = computeConfidence({
      modelProbability: 0.8,
      edge: 0.3,
      dataQuality: dq({ synthetic: true }),
      calibrationSamples: [],
      marketProbability: 0.4
    });
    expect(confidence).not.toBe('alta');
  });

  it('flags large model/market discrepancy as low confidence instead of rewarding it', () => {
    const confidence = computeConfidence({
      modelProbability: 0.9,
      edge: 0.5,
      dataQuality: dq(),
      calibrationSamples: [],
      marketProbability: 0.3 // 60pp discrepancy
    });
    expect(confidence).toBe('baixa');
  });

  it('can reach "alta" only with real data, positive edge, and calibration evidence', () => {
    const manySamples = Array.from({ length: 120 }, (_, i) => ({ predictedProbability: 0.6, outcome: (i % 2 === 0 ? 1 : 0) as 0 | 1 }));
    const confidence = computeConfidence({
      modelProbability: 0.65,
      edge: 0.08,
      dataQuality: dq({ synthetic: false }),
      calibrationSamples: manySamples,
      marketProbability: 0.57
    });
    expect(confidence).toBe('alta');
  });
});

describe('computeScore', () => {
  it('rewards higher edge and EV with a higher score, all else equal', () => {
    const base = { modelProbability: 0.6, marketProbability: 0.5, dataQuality: dq(), calibrationSamples: [] };
    const lowEdge = computeScore({ ...base, edge: 0.01, expectedValue: 0.02 });
    const highEdge = computeScore({ ...base, edge: 0.12, expectedValue: 0.25 });
    expect(highEdge).toBeGreaterThan(lowEdge);
  });

  it('penalizes insufficient/synthetic data quality relative to real, sufficient data', () => {
    const shared = { modelProbability: 0.65, marketProbability: 0.5, edge: 0.1, expectedValue: 0.2, calibrationSamples: [] };
    const realData = computeScore({ ...shared, dataQuality: dq({ synthetic: false }) });
    const syntheticData = computeScore({ ...shared, dataQuality: dq({ synthetic: true }) });
    expect(realData).toBeGreaterThan(syntheticData);
  });

  it('never produces a negative score for a positive-edge, positive-EV bet', () => {
    const score = computeScore({ modelProbability: 0.55, marketProbability: 0.5, edge: 0.02, expectedValue: 0.01, dataQuality: dq(), calibrationSamples: [] });
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
