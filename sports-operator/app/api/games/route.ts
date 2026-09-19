import { NextResponse } from 'next/server';
import { getOddsProvider } from '../../../lib/providers/odds';
import { OddsProviderError } from '../../../lib/providers/odds/errors';
import type { GamesResponse } from '../../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = getOddsProvider();

  try {
    const games = await provider.fetchUpcomingGames();
    const body: GamesResponse = {
      demo: provider.isDemo,
      provider: provider.name,
      fetchedAt: new Date().toISOString(),
      games
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error('[api/games] provider error:', err);
    // Never crash the UI on an external API failure; degrade with a clear
    // error flag. Crucially: `demo` still reflects the REAL provider state
    // (false when theoddsapi is configured), so the UI never silently
    // mixes demo data into a "dados reais" context on failure.
    const body: GamesResponse & { errorCode?: string } = {
      demo: provider.isDemo,
      provider: provider.name,
      fetchedAt: new Date().toISOString(),
      games: [],
      error: err instanceof Error ? err.message : 'Erro desconhecido ao buscar jogos.',
      errorCode: err instanceof OddsProviderError ? err.code : 'unknown'
    };
    return NextResponse.json(body, { status: 502 });
  }
}
