import type { HistoricalMatch, SportsDataProvider } from './types';
import { OddsProviderError } from '../odds/errors';

const BASE_URL = 'https://api.football-data.org/v4';
const REQUEST_TIMEOUT_MS = 12000;

// Maps our internal league labels (shared with the odds provider) to
// football-data.org competition codes. Free tier does NOT include the
// Brazilian Série A — documented limitation, not a bug.
const LEAGUE_CODE_MAP: Record<string, string> = {
  'Premier League': 'PL',
  'La Liga': 'PD',
  'Serie A (Itália)': 'SA',
  Bundesliga: 'BL1',
  'Ligue 1': 'FL1',
  'Champions League': 'CL'
};

interface RawTeam {
  name?: unknown;
}
interface RawScoreFullTime {
  home?: unknown;
  away?: unknown;
}
interface RawScore {
  fullTime?: unknown;
}
interface RawMatch {
  utcDate?: unknown;
  status?: unknown;
  homeTeam?: unknown;
  awayTeam?: unknown;
  score?: unknown;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseMatch(raw: unknown, league: string): HistoricalMatch | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as RawMatch;
  if (m.status !== 'FINISHED' || !isNonEmptyString(m.utcDate)) return null;

  const home = m.homeTeam as RawTeam | undefined;
  const away = m.awayTeam as RawTeam | undefined;
  if (!home || !away || !isNonEmptyString(home.name) || !isNonEmptyString(away.name)) return null;

  const score = m.score as RawScore | undefined;
  const fullTime = score?.fullTime as RawScoreFullTime | undefined;
  if (!fullTime || !isFiniteNumber(fullTime.home) || !isFiniteNumber(fullTime.away)) return null;

  return {
    date: m.utcDate,
    league,
    homeTeam: home.name,
    awayTeam: away.name,
    homeGoals: fullTime.home,
    awayGoals: fullTime.away
  };
}

export class FootballDataOrgProvider implements SportsDataProvider {
  name = 'football-data.org';
  synthetic = false;

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchHistoricalMatches(league: string, asOf: Date, lookbackDays: number): Promise<HistoricalMatch[]> {
    const code = LEAGUE_CODE_MAP[league];
    if (!code) {
      // Not a hard error: this league simply isn't covered by this provider's
      // free-tier competitions (e.g. Brasileirão). Caller treats an empty
      // result as "insufficient data" -> NO BET, never as a crash.
      return [];
    }

    const dateFrom = new Date(asOf.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const url = `${BASE_URL}/competitions/${code}/matches?status=FINISHED&dateFrom=${dateFrom
      .toISOString()
      .slice(0, 10)}&dateTo=${asOf.toISOString().slice(0, 10)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'X-Auth-Token': this.apiKey }
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw isAbort
        ? new OddsProviderError('timeout', `Tempo esgotado ao consultar football-data.org (${league}).`)
        : new OddsProviderError('network', `Falha de rede ao consultar football-data.org: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      throw new OddsProviderError('invalid_key', 'Chave da football-data.org inválida ou não autorizada.');
    }
    if (response.status === 429) {
      throw new OddsProviderError('rate_limited', 'Limite de requisições da football-data.org atingido.');
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new OddsProviderError('unavailable', `football-data.org retornou status ${response.status}: ${body.slice(0, 200)}`);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new OddsProviderError('invalid_response', 'Resposta inválida (não-JSON) da football-data.org.');
    }

    const matches = (json as { matches?: unknown })?.matches;
    if (!Array.isArray(matches)) {
      throw new OddsProviderError('invalid_response', 'Formato inesperado na resposta da football-data.org.');
    }

    return matches
      .map((m) => parseMatch(m, league))
      .filter((m): m is HistoricalMatch => m !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}
