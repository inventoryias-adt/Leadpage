import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { EntryRecord, UserSettings } from '../types';
import type { PersistenceAdapter } from './types';

// Local SQLite persistence. Used for local development and as the default
// when no DATABASE_URL (Postgres/Supabase) is configured. All methods are
// async to satisfy the shared PersistenceAdapter interface, even though
// better-sqlite3 itself is synchronous under the hood.
const DB_PATH = process.env.DATABASE_PATH || './data/sports-operator.db';
const resolvedPath = path.isAbsolute(DB_PATH) ? DB_PATH : path.join(process.cwd(), DB_PATH);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __sportsOperatorSqlite: Database.Database | undefined;
}

function getDb(): Database.Database {
  if (!global.__sportsOperatorSqlite) {
    const db = new Database(resolvedPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    global.__sportsOperatorSqlite = db;
  }
  return global.__sportsOperatorSqlite;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      bankroll REAL NOT NULL,
      stake_percent REAL NOT NULL,
      max_stake REAL NOT NULL,
      profit_target REAL NOT NULL,
      min_probability REAL NOT NULL,
      min_odd REAL NOT NULL,
      max_odd REAL NOT NULL,
      max_legs_multiple INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      odd REAL NOT NULL,
      implied_probability REAL NOT NULL,
      model_probability REAL NOT NULL,
      edge REAL NOT NULL,
      expected_value REAL NOT NULL,
      score REAL NOT NULL,
      stake REAL NOT NULL,
      potential_return REAL NOT NULL,
      potential_profit REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      settled_at TEXT,
      profit_loss REAL,
      raw TEXT NOT NULL
    );
  `);

  const row = db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number };
  if (row.c === 0) {
    db.prepare(
      `INSERT INTO settings (id, bankroll, stake_percent, max_stake, profit_target, min_probability, min_odd, max_odd, max_legs_multiple)
       VALUES (1, 100, 2, 20, 10, 0.40, 1.30, 6.0, 3)`
    ).run();
  }
}

function rowToEntry(row: any): EntryRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    type: row.type,
    description: row.description,
    odd: row.odd,
    impliedProbability: row.implied_probability,
    modelProbability: row.model_probability,
    edge: row.edge,
    expectedValue: row.expected_value,
    score: row.score,
    stake: row.stake,
    potentialReturn: row.potential_return,
    potentialProfit: row.potential_profit,
    status: row.status,
    settledAt: row.settled_at,
    profitLoss: row.profit_loss,
    raw: row.raw
  };
}

export class SqliteAdapter implements PersistenceAdapter {
  async getSettings(): Promise<UserSettings> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
    return {
      bankroll: row.bankroll,
      stakePercent: row.stake_percent,
      maxStake: row.max_stake,
      profitTarget: row.profit_target,
      minProbability: row.min_probability,
      minOdd: row.min_odd,
      maxOdd: row.max_odd,
      maxLegsMultiple: row.max_legs_multiple
    };
  }

  async saveSettings(settings: UserSettings): Promise<UserSettings> {
    const db = getDb();
    db.prepare(
      `UPDATE settings SET bankroll = ?, stake_percent = ?, max_stake = ?, profit_target = ?,
       min_probability = ?, min_odd = ?, max_odd = ?, max_legs_multiple = ? WHERE id = 1`
    ).run(
      settings.bankroll,
      settings.stakePercent,
      settings.maxStake,
      settings.profitTarget,
      settings.minProbability,
      settings.minOdd,
      settings.maxOdd,
      settings.maxLegsMultiple
    );
    return this.getSettings();
  }

  async listEntries(): Promise<EntryRecord[]> {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM entries ORDER BY created_at DESC').all();
    return rows.map(rowToEntry);
  }

  async createEntry(entry: EntryRecord): Promise<EntryRecord> {
    const db = getDb();
    db.prepare(
      `INSERT INTO entries (id, created_at, type, description, odd, implied_probability, model_probability,
        edge, expected_value, score, stake, potential_return, potential_profit, status, settled_at, profit_loss, raw)
       VALUES (@id, @createdAt, @type, @description, @odd, @impliedProbability, @modelProbability,
        @edge, @expectedValue, @score, @stake, @potentialReturn, @potentialProfit, @status, @settledAt, @profitLoss, @raw)`
    ).run({
      ...entry,
      settledAt: entry.settledAt ?? null,
      profitLoss: entry.profitLoss ?? null
    });
    return entry;
  }

  async updateEntryStatus(id: string, status: 'win' | 'loss' | 'void'): Promise<EntryRecord | null> {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as any;
    if (!existing) return null;

    let profitLoss = 0;
    if (status === 'win') profitLoss = existing.potential_profit;
    else if (status === 'loss') profitLoss = -existing.stake;
    else profitLoss = 0; // void: stake returned, no profit/loss

    db.prepare(`UPDATE entries SET status = ?, settled_at = ?, profit_loss = ? WHERE id = ?`).run(
      status,
      new Date().toISOString(),
      profitLoss,
      id
    );

    return rowToEntry(db.prepare('SELECT * FROM entries WHERE id = ?').get(id));
  }

  async deleteEntry(id: string): Promise<boolean> {
    const db = getDb();
    const result = db.prepare('DELETE FROM entries WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
