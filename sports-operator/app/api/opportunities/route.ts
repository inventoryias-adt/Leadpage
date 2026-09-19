import { NextResponse } from 'next/server';
import { getSettings } from '../../../lib/db';
import { getOddsProvider } from '../../../lib/providers/odds';
import { OddsProviderError } from '../../../lib/providers/odds/errors';
import { getSportsDataProvider } from '../../../lib/providers/sportsdata';
import { buildOpportunities } from '../../../lib/analysis/engine';
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

  try {
    const games = await oddsProvider.fetchTodayGames();
    const { opportunities, noBets } = await buildOpportunities(games, settings, { sportsDataProvider });
    return NextResponse.json({
      demo: oddsProvider.isDemo,
      provider: oddsProvider.name,
      modelDataSynthetic: sportsDataProvider.synthetic,
      modelDataProvider: sportsDataProvider.name,
      fetchedAt: new Date().toISOString(),
      settings,
      opportunities,
      noBets
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
        error: err instanceof Error ? err.message : 'Erro desconhecido ao gerar oportunidades.',
        errorCode: code
      },
      { status: 502 }
    );
  }
}
