import type { Game, MarketKey, OddsMarket } from '../../types';
import type { OddsProvider } from './types';
import { OddsProviderError } from './errors';

const BASE_URL = 'https://api.the-odds-api.com/v4';
const REQUEST_TIMEOUT_MS = 12000;

// The Odds API has no single "soccer" umbrella sport key — each league is
// its own sport key (see GET /v4/sports). We query a curated set of major
// football leagues in parallel and merge the results. A league that is
// off-season (empty array) or transiently failing does not fail the whole
// request; only a systemic failure (bad key, rate limit, network down on
// every league) does.
const FOOTBALL_LEAGUE_KEYS = [
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_italy_serie_a',
  'soccer_germany_bundesliga',
  'soccer_france_ligue_one',
  'soccer_brazil_campeonato',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league'
];

// Minimal shape validation for data coming from an external API.
// We never trust external payloads blindly.
interface RawOutcome {
  name?: unknown;
  price?: unknown;
  point?: unknown;
}
interface RawMarket {
  key?: unknown;
  outcomes?: unknown;
}
interface RawBookmaker {
  title?: unknown;
  markets?: unknown;
}
interface RawEvent {
  id?: unknown;
  sport_title?: unknown;
  commence_time?: unknown;
  home_team?: unknown;
  away_team?: unknown;
  bookmakers?: unknown;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function mapMarketKey(key: string): { marketKey: MarketKey; label: string } | null {
  switch (key) {
    case 'h2h':
      return { marketKey: 'h2h', label: 'Resultado Final (1X2)' };
    case 'totals':
      return { marketKey: 'over_under_2_5', label: 'Mais/Menos Gols' };
    case 'btts':
      return { marketKey: 'btts', label: 'Ambas Marcam' };
    default:
      return null;
  }
}

function parseEvent(raw: unknown): Game | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const ev = raw as RawEvent;
  if (
    !isNonEmptyString(ev.id) ||
    !isNonEmptyString(ev.sport_title) ||
    !isNonEmptyString(ev.commence_time) ||
    !isNonEmptyString(ev.home_team) ||
    !isNonEmptyString(ev.away_team) ||
    !Array.isArray(ev.bookmakers)
  ) {
    return null;
  }

  const markets: OddsMarket[] = [];

  for (const bm of ev.bookmakers as unknown[]) {
    if (typeof bm !== 'object' || bm === null) continue;
    const bookmaker = bm as RawBookmaker;
    if (!isNonEmptyString(bookmaker.title) || !Array.isArray(bookmaker.markets)) continue;

    for (const mk of bookmaker.markets as unknown[]) {
      if (typeof mk !== 'object' || mk === null) continue;
      const market = mk as RawMarket;
      if (!isNonEmptyString(market.key) || !Array.isArray(market.outcomes)) continue;

      const mapped = mapMarketKey(market.key);
      if (!mapped) continue;

      const outcomes = (market.outcomes as unknown[])
        .map((o) => {
          if (typeof o !== 'object' || o === null) return null;
          const out = o as RawOutcome;
          if (!isNonEmptyString(out.name) || !isFiniteNumber(out.price) || out.price <= 1) return null;
          // For the "totals" market The Odds API returns bare "Over"/"Under" in
          // `name` and puts the actual goal line in `point` — if we don't fold
          // the line into the name, extractLine() in markets.ts has no digit to
          // read and silently falls back to a default of 2.5 for every line,
          // and the UI shows an unexplained "Over"/"Under" with no number at
          // all. Building the clear Portuguese label here keeps both the model
          // math and the on-screen text correct for any line (0.5, 1.5, ...).
          if (market.key === 'totals' && isFiniteNumber(out.point)) {
            const lineLabel = out.point === 0.5 ? 'gol' : 'gols';
            const clearName =
              out.name === 'Over' ? `Mais de ${out.point} ${lineLabel}` : `Menos de ${out.point} ${lineLabel}`;
            return { name: clearName, price: out.price };
          }
          return { name: out.name, price: out.price };
        })
        .filter((o): o is { name: string; price: number } => o !== null);

      if (outcomes.length >= 2) {
        markets.push({
          marketKey: mapped.marketKey,
          marketLabel: mapped.label,
          bookmaker: bookmaker.title,
          outcomes
        });
      }
    }
  }

  if (markets.length === 0) return null;

  return {
    id: ev.id,
    league: ev.sport_title,
    commenceTime: ev.commence_time,
    homeTeam: ev.home_team,
    awayTeam: ev.away_team,
    markets
  };
}

type LeagueResult =
  | { ok: true; league: string; games: Game[] }
  | { ok: false; league: string; error: OddsProviderError };

export class TheOddsApiProvider implements OddsProvider {
  name = 'the-odds-api';
  isDemo = false;

  private apiKey: string;
  private region: string;

  constructor(apiKey: string, region = 'eu') {
    this.apiKey = apiKey;
    this.region = region;
  }

  private async fetchLeague(leagueKey: string): Promise<LeagueResult> {
    const url = `${BASE_URL}/sports/${leagueKey}/odds/?apiKey=${encodeURIComponent(
      this.apiKey
    )}&regions=${encodeURIComponent(this.region)}&markets=h2h,totals&oddsFormat=decimal`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        league: leagueKey,
        error: isAbort
          ? new OddsProviderError('timeout', `Tempo esgotado ao consultar ${leagueKey}.`)
          : new OddsProviderError('network', `Falha de rede ao consultar ${leagueKey}: ${(err as Error).message}`)
      };
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401) {
      return { ok: false, league: leagueKey, error: new OddsProviderError('invalid_key', 'Chave da The Odds API inválida ou não autorizada.') };
    }
    if (response.status === 429) {
      return { ok: false, league: leagueKey, error: new OddsProviderError('rate_limited', 'Limite de requisições da The Odds API atingido.') };
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        ok: false,
        league: leagueKey,
        error: new OddsProviderError('unavailable', `The Odds API retornou status ${response.status} para ${leagueKey}: ${body.slice(0, 200)}`)
      };
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { ok: false, league: leagueKey, error: new OddsProviderError('invalid_response', `Resposta inválida (não-JSON) da The Odds API para ${leagueKey}.`) };
    }

    if (!Array.isArray(json)) {
      return { ok: false, league: leagueKey, error: new OddsProviderError('invalid_response', `Formato inesperado na resposta da The Odds API para ${leagueKey}.`) };
    }

    const games = json.map(parseEvent).filter((g): g is Game => g !== null);
    return { ok: true, league: leagueKey, games };
  }

  async fetchTodayGames(): Promise<Game[]> {
    const results = await Promise.all(FOOTBALL_LEAGUE_KEYS.map((key) => this.fetchLeague(key)));

    const succeeded = results.filter((r): r is Extract<LeagueResult, { ok: true }> => r.ok);
    const failed = results.filter((r): r is Extract<LeagueResult, { ok: false }> => !r.ok);

    // Only surface a hard error when EVERY league failed — a single flaky
    // or off-season league must not take down the whole board.
    if (succeeded.length === 0 && failed.length > 0) {
      const first = failed[0].error;
      console.error(
        '[the-odds-api] all leagues failed:',
        failed.map((f) => `${f.league}: ${f.error.code} - ${f.error.message}`).join(' | ')
      );
      throw first;
    }

    if (failed.length > 0) {
      console.warn(
        '[the-odds-api] some leagues failed, continuing with the rest:',
        failed.map((f) => `${f.league}: ${f.error.code}`).join(', ')
      );
    }

    const now = Date.now();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const games = succeeded
      .flatMap((r) => r.games)
      .filter((g) => {
        const t = new Date(g.commenceTime).getTime();
        return Number.isFinite(t) && t >= now - 1000 * 60 * 60 * 3 && t <= endOfDay.getTime();
      });

    // Empty result (no games found today across all leagues) is a valid,
    // non-error outcome — the caller/UI shows "nenhum jogo hoje", not an error.
    return games;
  }
}
