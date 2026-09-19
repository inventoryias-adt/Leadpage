import { DemoSportsDataProvider } from './demoSportsDataProvider';
import { FootballDataOrgProvider } from './footballDataOrgProvider';
import type { SportsDataProvider } from './types';

// Factory mirroring lib/providers/odds/index.ts: real provider requires
// explicit opt-in + a key, otherwise falls back to the clearly-labeled
// synthetic demo provider. Swapping providers touches only this file.
export function getSportsDataProvider(): SportsDataProvider {
  const configured = (process.env.SPORTS_DATA_PROVIDER || 'demo').toLowerCase();
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (configured === 'footballdata' && isNonEmpty(apiKey)) {
    return new FootballDataOrgProvider(apiKey);
  }

  return new DemoSportsDataProvider();
}

function isNonEmpty(v: string | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export type { SportsDataProvider, HistoricalMatch } from './types';
