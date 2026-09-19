import { NextResponse } from 'next/server';
import { getSettings } from '../../../lib/db';
import { getOddsProvider } from '../../../lib/providers/odds';
import { OddsProviderError } from '../../../lib/providers/odds/errors';
import { buildOpportunities } from '../../../lib/analysis/engine';
import type { UserSettings } from '../../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = getOddsProvider();

  let settings: UserSettings;
  try {
    settings = await getSettings();
  } catch (err) {
    console.error('[api/opportunities] settings error:', err);
    return NextResponse.json({ error: 'Erro ao ler configurações do banco.' }, { status: 500 });
  }

  try {
    const games = await provider.fetchTodayGames();
    const opportunities = buildOpportunities(games, settings);
    return NextResponse.json({
      demo: provider.isDemo,
      provider: provider.name,
      fetchedAt: new Date().toISOString(),
      settings,
      opportunities
    });
  } catch (err) {
    console.error('[api/opportunities] error:', err);
    const code = err instanceof OddsProviderError ? err.code : 'unknown';
    return NextResponse.json(
      {
        demo: provider.isDemo,
        provider: provider.name,
        fetchedAt: new Date().toISOString(),
        settings,
        opportunities: [],
        error: err instanceof Error ? err.message : 'Erro desconhecido ao gerar oportunidades.',
        errorCode: code
      },
      { status: 502 }
    );
  }
}
