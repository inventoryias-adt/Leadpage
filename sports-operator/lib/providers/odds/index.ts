import { DemoOddsProvider } from './demoProvider';
import { TheOddsApiProvider } from './theOddsApiProvider';
import type { OddsProvider } from './types';

// Factory: swapping the odds provider later means editing only this file
// (or adding a new case), never any UI or API-route code.
export function getOddsProvider(): OddsProvider {
  const configured = (process.env.ODDS_PROVIDER || 'demo').toLowerCase();
  const apiKey = process.env.THE_ODDS_API_KEY;

  if (configured === 'theoddsapi' && isNonEmpty(apiKey)) {
    return new TheOddsApiProvider(apiKey, process.env.ODDS_REGION || 'eu');
  }

  // No provider configured or missing key -> fall back to DEMO explicitly.
  return new DemoOddsProvider();
}

function isNonEmpty(v: string | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export type { OddsProvider } from './types';
