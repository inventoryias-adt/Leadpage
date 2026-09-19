import type { DataQuality } from '../../types';
import { hasSufficientCalibrationEvidence, type CalibrationSample } from '../calibration/calibration';

// Score formula, documented (replaces the old arbitrary weighting):
//
//   score = 40 * predictionQuality + 25 * edgeComponent + 20 * evComponent
//           + 10 * dataQualityComponent + 5 * calibrationComponent
//
// Weights are an initial, pragmatic allocation — not fit to data yet.
// TODO (v2): recalibrate weights once real backtest/settled-entry data
// accumulates (see lib/analysis/backtest/).
const WEIGHTS = {
  predictionQuality: 40,
  edge: 25,
  expectedValue: 20,
  dataQuality: 10,
  calibration: 5
};

export interface ScoreInputs {
  modelProbability: number;
  marketProbability: number;
  edge: number;
  expectedValue: number;
  dataQuality: DataQuality;
  calibrationSamples: CalibrationSample[];
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function computeScore(inputs: ScoreInputs): number {
  // predictionQuality: how confident/decisive the model's own estimate is
  // (distance from a coin-flip), independent of the market.
  const predictionQuality = clamp01(Math.abs(inputs.modelProbability - 0.5) * 2);

  const edgeComponent = clamp01(Math.max(0, inputs.edge) / 0.15); // +15pp edge maxes this out
  const evComponent = clamp01(Math.max(0, inputs.expectedValue) / 0.3); // EV of 0.3/unit maxes this out

  const dataQualityComponent = inputs.dataQuality.sufficientSample && !inputs.dataQuality.synthetic ? 1 : inputs.dataQuality.sufficientSample ? 0.5 : 0;

  const calibrationComponent = hasSufficientCalibrationEvidence(inputs.calibrationSamples) ? 1 : 0;

  const score =
    WEIGHTS.predictionQuality * predictionQuality +
    WEIGHTS.edge * edgeComponent +
    WEIGHTS.expectedValue * evComponent +
    WEIGHTS.dataQuality * dataQualityComponent +
    WEIGHTS.calibration * calibrationComponent;

  return +score.toFixed(2);
}

export type Confidence = 'alta' | 'media' | 'baixa';

export interface ConfidenceInputs {
  modelProbability: number;
  edge: number;
  dataQuality: DataQuality;
  calibrationSamples: CalibrationSample[];
  marketProbability: number;
}

// Confidence is deliberately conservative: it can never reach "alta"
// without (a) a sufficient real (non-synthetic) sample, (b) a real edge,
// and (c) at least some calibration evidence. A high modelProbability
// alone (e.g. 95%) is NOT sufficient — this directly implements the
// "não quero 95% = confiança alta automaticamente" requirement.
export function computeConfidence(inputs: ConfidenceInputs): Confidence {
  const { dataQuality, edge, calibrationSamples, modelProbability, marketProbability } = inputs;

  if (!dataQuality.sufficientSample) return 'baixa';

  const discrepancy = Math.abs(modelProbability - marketProbability);
  if (discrepancy > 0.25) return 'baixa'; // model and market wildly disagree -> treat as a red flag, not a bonus

  const calibrationProven = hasSufficientCalibrationEvidence(calibrationSamples);

  if (dataQuality.synthetic) {
    // Demo/synthetic data can validate the pipeline but must never earn
    // top confidence, however good the numbers look.
    return edge > 0.05 ? 'media' : 'baixa';
  }

  if (calibrationProven && edge >= 0.05) return 'alta';
  if (edge >= 0.02) return 'media';
  return 'baixa';
}
