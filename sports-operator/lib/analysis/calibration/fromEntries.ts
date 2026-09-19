import type { EntryRecord } from '../../types';
import type { CalibrationSample } from './calibration';

// Bridges persisted, user-settled entries into calibration evidence for the
// live engine. Kept separate from calibration.ts (which stays a pure,
// dependency-free stats module) since this one reads app-specific types.
//
// Only WIN/LOSS entries count — PENDING has no known outcome yet, and VOID
// means the bet never resolved (push/cancelled), so it carries no signal
// about whether the model's probability was right.
//
// Samples are further filtered to the CURRENT model version: an entry
// registered under an older model (e.g. a future football-v2) must never
// be counted as evidence for football-v1's calibration, or vice-versa —
// each model version's calibration must stand on its own.
export function entriesToCalibrationSamples(entries: EntryRecord[], modelVersion: string): CalibrationSample[] {
  const samples: CalibrationSample[] = [];

  for (const entry of entries) {
    if (entry.status !== 'win' && entry.status !== 'loss') continue;

    let entryModelVersion: unknown;
    try {
      entryModelVersion = JSON.parse(entry.raw)?.modelVersion;
    } catch {
      entryModelVersion = undefined;
    }
    if (entryModelVersion !== modelVersion) continue;

    samples.push({
      predictedProbability: entry.modelProbability,
      outcome: entry.status === 'win' ? 1 : 0
    });
  }

  return samples;
}
