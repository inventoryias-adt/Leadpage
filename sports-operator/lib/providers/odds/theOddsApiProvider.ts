import type { Game, MarketKey, OddsMarket } from '../../types';
import type { OddsProvider } from './types';

const BASE_URL = 'https://api.the-odds-api.com/v4';

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

export class TheOddsApiProvider implements OddsProvider {
  name = 'the-odds-api';
  isDemo = false;

  private apiKey: string;
  private region: string;

  constructor(apiKey: string, region = 'eu') {
    this.apiKey = apiKey;
    this.region = region;
  }

  async fetchTodayGames(): Promise<Game[]> {
    const url = `${BASE_URL}/sports/soccer/odds/?apiKey=${encodeURIComponent(
      this.apiKey
    )}&regions=${encodeURIComponent(this.region)}&markets=h2h,totals&oddsFormat=decimal`;

    let response: Response;
    try {
      response = await fetch(url, { cache: 'no-store' });
    } catch (err) {
      throw new Error(`Falha de rede ao consultar a API de odds: ${(err as Error).message}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`API de odds retornou status ${response.status}: ${body.slice(0, 300)}`);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new Error('Resposta da API de odds não é um JSON válido.');
    }

    if (!Array.isArray(json)) {
      throw new Error('Formato inesperado na resposta da API de odds.');
    }

    const now = Date.now();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const games = json
      .map(parseEvent)
      .filter((g): g is Game => g !== null)
      .filter((g) => {
        const t = new Date(g.commenceTime).getTime();
        return Number.isFinite(t) && t >= now - 1000 * 60 * 60 * 3 && t <= endOfDay.getTime();
      });

    return games;
  }
}
