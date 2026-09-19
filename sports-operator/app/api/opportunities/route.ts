import { NextResponse } from 'next/server';
import { getSettings } from '../../../lib/db';
import { getOddsProvider } from '../../../lib/providers/odds';
import { buildOpportunities } from '../../../lib/analysis/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = getOddsProvider();
  const settings = getSettings();

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
    return NextResponse.json(
      {
        demo: provider.isDemo,
        provider: provider.name,
        fetchedAt: new Date().toISOString(),
        settings,
        opportunities: [],
        error: err instanceof Error ? err.message : 'Erro desconhecido ao gerar oportunidades.'
      },
      { status: 502 }
    );
  }
}
