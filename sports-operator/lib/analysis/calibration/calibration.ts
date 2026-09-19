// Calibration utilities: "when the model says 70%, how often does it
// actually happen?" These operate on any list of (predicted probability,
// realized binary outcome) pairs — produced by the backtest module, or
// later by real settled entries once enough of them accumulate.

export interface CalibrationSample {
  predictedProbability: number; // 0..1
  outcome: 0 | 1; // 1 = the predicted event happened
}

export interface CalibrationBucket {
  rangeLabel: string;
  rangeMin: number;
  rangeMax: number;
  count: number;
  avgPredicted: number;
  observedFrequency: number | null; // null when count === 0
}

const DEFAULT_BOUNDARIES = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.01];

export function computeCalibrationCurve(
  samples: CalibrationSample[],
  boundaries: number[] = DEFAULT_BOUNDARIES
): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = [];
  let lower = 0;

  for (const upper of boundaries) {
    const inBucket = samples.filter((s) => s.predictedProbability >= lower && s.predictedProbability < upper);
    const count = inBucket.length;
    buckets.push({
      rangeLabel: `${(lower * 100).toFixed(0)}%–${Math.min(upper, 1) * 100}%`,
      rangeMin: lower,
      rangeMax: upper,
      count,
      avgPredicted: count > 0 ? inBucket.reduce((a, s) => a + s.predictedProbability, 0) / count : 0,
      observedFrequency: count > 0 ? inBucket.reduce((a, s) => a + s.outcome, 0) / count : null
    });
    lower = upper;
  }

  return buckets;
}

export function brierScore(samples: CalibrationSample[]): number | null {
  if (samples.length === 0) return null;
  const sum = samples.reduce((a, s) => a + (s.predictedProbability - s.outcome) ** 2, 0);
  return sum / samples.length;
}

export function logLoss(samples: CalibrationSample[]): number | null {
  if (samples.length === 0) return null;
  const eps = 1e-9;
  const sum = samples.reduce((a, s) => {
    const p = Math.min(1 - eps, Math.max(eps, s.predictedProbability));
    return a + (s.outcome === 1 ? -Math.log(p) : -Math.log(1 - p));
  }, 0);
  return sum / samples.length;
}

export function accuracy(samples: CalibrationSample[], threshold = 0.5): number | null {
  if (samples.length === 0) return null;
  const correct = samples.filter((s) => (s.predictedProbability >= threshold ? 1 : 0) === s.outcome).length;
  return correct / samples.length;
}

// A model is only considered "calibration-proven" once it has enough
// settled samples to say anything statistically meaningful. Below this,
// confidence scoring must not claim calibration backing (see scoring/).
export const MIN_SAMPLES_FOR_CALIBRATION_CLAIM = 100;

export function hasSufficientCalibrationEvidence(samples: CalibrationSample[]): boolean {
  return samples.length >= MIN_SAMPLES_FOR_CALIBRATION_CLAIM;
}
