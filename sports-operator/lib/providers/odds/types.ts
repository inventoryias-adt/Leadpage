import type { Game } from '../../types';

export interface OddsProvider {
  name: string;
  isDemo: boolean;
  // Returns every upcoming game within the round window (see provider
  // implementations), not just "today" — a league round commonly spans
  // several days (e.g. Fri-Mon) and midweek cup rounds don't align with
  // any single day either.
  fetchUpcomingGames(): Promise<Game[]>;
}
