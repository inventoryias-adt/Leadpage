import type { EntryRecord, UserSettings } from '../types';

// Persistence adapter contract. The rest of the application (API routes)
// depends only on this interface, never on SQLite or Postgres directly —
// swapping the backing store means editing lib/db/index.ts only.
export interface PersistenceAdapter {
  getSettings(): Promise<UserSettings>;
  saveSettings(settings: UserSettings): Promise<UserSettings>;
  listEntries(): Promise<EntryRecord[]>;
  createEntry(entry: EntryRecord): Promise<EntryRecord>;
  updateEntryStatus(id: string, status: 'win' | 'loss' | 'void'): Promise<EntryRecord | null>;
  deleteEntry(id: string): Promise<boolean>;
}
