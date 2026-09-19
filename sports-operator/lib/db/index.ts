import { SqliteAdapter } from './sqliteAdapter';
import { PostgresAdapter } from './postgresAdapter';
import type { PersistenceAdapter } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __sportsOperatorAdapter: PersistenceAdapter | undefined;
}

// Factory: LOCAL uses SQLite by default. PRODUCTION uses Postgres/Supabase
// whenever DATABASE_URL is set. The rest of the app only imports the
// functions below and never touches better-sqlite3 or pg directly.
function getAdapter(): PersistenceAdapter {
  if (!global.__sportsOperatorAdapter) {
    global.__sportsOperatorAdapter = process.env.DATABASE_URL ? new PostgresAdapter() : new SqliteAdapter();
  }
  return global.__sportsOperatorAdapter;
}

export function getSettings() {
  return getAdapter().getSettings();
}
export function saveSettings(settings: Parameters<PersistenceAdapter['saveSettings']>[0]) {
  return getAdapter().saveSettings(settings);
}
export function listEntries() {
  return getAdapter().listEntries();
}
export function createEntry(entry: Parameters<PersistenceAdapter['createEntry']>[0]) {
  return getAdapter().createEntry(entry);
}
export function updateEntryStatus(id: string, status: 'win' | 'loss' | 'void') {
  return getAdapter().updateEntryStatus(id, status);
}
export function deleteEntry(id: string) {
  return getAdapter().deleteEntry(id);
}
