import { NextResponse } from 'next/server';
import { getSettings, listEntries } from '../../../lib/db';
import { getOddsProvider } from '../../../lib/providers/odds';
import { OddsProviderError } from '../../../lib/providers/odds/errors';
import { getSportsDataProvider } from '../../../lib/providers/sportsdata';
import { buildOpportunities } from '../../../lib/analysis/engine';
import { MODEL_VERSION } from '../../../lib/analysis/models/footballV1';
import { entriesToCalibrationSamples } from '../../../lib/analysis/calibration/fromEntries';
import { hasSufficientCalibrationEvidence, MIN_SAMPLES_FOR_CALIBRATION_CLAIM } from '../../../lib/analysis/calibration/calibration';
import type { UserSettings } from '../../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const oddsProvider = getOddsProvider();
  const sportsDataProvider = getSportsDataProvider();

  let settings: UserSettings;
  try {
    settings = await getSettings();
  } catch (err) {
    console.error('[api/opportunities] settings error:', err);
    return NextResponse.json({ error: 'Erro ao ler configurações do banco.' }, { status: 500 });
  }

  // Feedback loop: settled WIN/LOSS entries from previous recommendations
  // become the calibration evidence for THIS model version. Never blocks
  // the request — a failure here just means confidence stays conservative.
  let calibrationSamples: ReturnType<typeof entriesToCalibrationSamples> = [];
  try {
    const entries = await listEntries();
    calibrationSamples = entriesToCalibrationSamples(entries, MODEL_VERSION);
  } catch (err) {
    console.warn('[api/opportunities] could not load calibration samples from entries:', err);
  }

  try {
    const games = await oddsProvider.fetchTodayGames();
    const { opportunities, noBets } = await buildOpportunities(games, settings, { sportsDataProvider, calibrationSamples });
    return NextResponse.json({
      demo: oddsProvider.isDemo,
      provider: oddsProvider.name,
      modelDataSynthetic: sportsDataProvider.synthetic,
      modelDataProvider: sportsDataProvider.name,
      fetchedAt: new Date().toISOString(),
      settings,
      opportunities,
      noBets,
      calibration: {
        modelVersion: MODEL_VERSION,
        sampleCount: calibrationSamples.length,
        minRequired: MIN_SAMPLES_FOR_CALIBRATION_CLAIM,
        proven: hasSufficientCalibrationEvidence(calibrationSamples)
      }
    });
  } catch (err) {
    console.error('[api/opportunities] error:', err);
    const code = err instanceof OddsProviderError ? err.code : 'unknown';
    return NextResponse.json(
      {
        demo: oddsProvider.isDemo,
        provider: oddsProvider.name,
        modelDataSynthetic: sportsDataProvider.synthetic,
        modelDataProvider: sportsDataProvider.name,
        fetchedAt: new Date().toISOString(),
        settings,
        opportunities: [],
        noBets: [],
        calibration: {
          modelVersion: MODEL_VERSION,
          sampleCount: calibrationSamples.length,
          minRequired: MIN_SAMPLES_FOR_CALIBRATION_CLAIM,
          proven: hasSufficientCalibrationEvidence(calibrationSamples)
        },
        error: err instanceof Error ? err.message : 'Erro desconhecido ao gerar oportunidades.',
        errorCode: code
      },
      { status: 502 }
    );
  }
}
