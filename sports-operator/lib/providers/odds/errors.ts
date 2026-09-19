export type OddsErrorCode =
  | 'invalid_key'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'invalid_response'
  | 'unavailable';

// Distinct, typed error surfaced by odds providers so API routes and the
// UI can react appropriately (e.g. never silently fall back to demo data
// when the real provider fails — the caller decides what to show).
export class OddsProviderError extends Error {
  code: OddsErrorCode;

  constructor(code: OddsErrorCode, message: string) {
    super(message);
    this.name = 'OddsProviderError';
    this.code = code;
  }
}
