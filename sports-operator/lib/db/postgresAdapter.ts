import { Pool } from 'pg';
import type { EntryRecord, UserSettings } from '../types';
import type { PersistenceAdapter } from './types';

// Production persistence backed by Postgres (Supabase). Schema mirrors the
// SQLite adapter 1:1 (see migrations documented in README). The pool is
// cached on `global` so serverless warm invocations reuse connections
// instead of opening a new one per request.
declare global {
  // eslint-disable-next-line no-var
  var __sportsOperatorPgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global.__sportsOperatorPgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não configurada — necessária para o adapter Postgres.');
    }
    global.__sportsOperatorPgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5
    });
  }
  return global.__sportsOperatorPgPool;
}

function rowToEntry(row: any): EntryRecord {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    type: row.type,
    description: row.description,
    odd: Number(row.odd),
    impliedProbability: Number(row.implied_probability),
    modelProbability: Number(row.model_probability),
    edge: Number(row.edge),
    expectedValue: Number(row.expected_value),
    score: Number(row.score),
    stake: Number(row.stake),
    potentialReturn: Number(row.potential_return),
    potentialProfit: Number(row.potential_profit),
    status: row.status,
    settledAt: row.settled_at ? new Date(row.settled_at).toISOString() : null,
    profitLoss: row.profit_loss != null ? Number(row.profit_loss) : null,
    raw: typeof row.raw === 'string' ? row.raw : JSON.stringify(row.raw)
  };
}

export class PostgresAdapter implements PersistenceAdapter {
  async getSettings(): Promise<UserSettings> {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM settings WHERE id = 1');
    const row = rows[0];
    return {
      bankroll: Number(row.bankroll),
      stakePercent: Number(row.stake_percent),
      maxStake: Number(row.max_stake),
      profitTarget: Number(row.profit_target),
      minProbability: Number(row.min_probability),
      minOdd: Number(row.min_odd),
      maxOdd: Number(row.max_odd),
      maxLegsMultiple: Number(row.max_legs_multiple)
    };
  }

  async saveSettings(settings: UserSettings): Promise<UserSettings> {
    const pool = getPool();
    await pool.query(
      `UPDATE settings SET bankroll = $1, stake_percent = $2, max_stake = $3, profit_target = $4,
       min_probability = $5, min_odd = $6, max_odd = $7, max_legs_multiple = $8 WHERE id = 1`,
      [
        settings.bankroll,
        settings.stakePercent,
        settings.maxStake,
        settings.profitTarget,
        settings.minProbability,
        settings.minOdd,
        settings.maxOdd,
        settings.maxLegsMultiple
      ]
    );
    return this.getSettings();
  }

  async listEntries(): Promise<EntryRecord[]> {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM entries ORDER BY created_at DESC');
    return rows.map(rowToEntry);
  }

  async createEntry(entry: EntryRecord): Promise<EntryRecord> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO entries (id, created_at, type, description, odd, implied_probability, model_probability,
        edge, expected_value, score, stake, potential_return, potential_profit, status, settled_at, profit_loss, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        entry.id,
        entry.createdAt,
        entry.type,
        entry.description,
        entry.odd,
        entry.impliedProbability,
        entry.modelProbability,
        entry.edge,
        entry.expectedValue,
        entry.score,
        entry.stake,
        entry.potentialReturn,
        entry.potentialProfit,
        entry.status,
        entry.settledAt ?? null,
        entry.profitLoss ?? null,
        entry.raw
      ]
    );
    return entry;
  }

  async updateEntryStatus(id: string, status: 'win' | 'loss' | 'void'): Promise<EntryRecord | null> {
    const pool = getPool();
    const existingRes = await pool.query('SELECT * FROM entries WHERE id = $1', [id]);
    const existing = existingRes.rows[0];
    if (!existing) return null;

    let profitLoss = 0;
    if (status === 'win') profitLoss = Number(existing.potential_profit);
    else if (status === 'loss') profitLoss = -Number(existing.stake);
    else profitLoss = 0;

    await pool.query('UPDATE entries SET status = $1, settled_at = $2, profit_loss = $3 WHERE id = $4', [
      status,
      new Date().toISOString(),
      profitLoss,
      id
    ]);

    const { rows } = await pool.query('SELECT * FROM entries WHERE id = $1', [id]);
    return rowToEntry(rows[0]);
  }

  async deleteEntry(id: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query('DELETE FROM entries WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
