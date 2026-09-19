import { NextResponse } from 'next/server';
import { getOddsProvider } from '../../../lib/providers/odds';
import type { GamesResponse } from '../../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = getOddsProvider();

  try {
    const games = await provider.fetchTodayGames();
    const body: GamesResponse = {
      demo: provider.isDemo,
      provider: provider.name,
      fetchedAt: new Date().toISOString(),
      games
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error('[api/games] provider error:', err);
    // Never crash the UI on an external API failure; degrade with a clear error flag.
    const body: GamesResponse = {
      demo: provider.isDemo,
      provider: provider.name,
      fetchedAt: new Date().toISOString(),
      games: [],
      error: err instanceof Error ? err.message : 'Erro desconhecido ao buscar jogos.'
    };
    return NextResponse.json(body, { status: 502 });
  }
}
