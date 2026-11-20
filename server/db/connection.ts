import pg from 'pg';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function databaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

export async function resetDatabasePool(): Promise<void> {
  const existing = poolInstance;
  poolInstance = null;
  if (existing) {
    try {
      await existing.end();
    } catch {
      // Ignore pool teardown errors on already-closed sockets
    }
  }
}

export function database(): pg.Pool {
  if (!poolInstance) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not configured');
    }
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 6,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      allowExitOnIdle: false,
    });
    pool.on('error', (err) => {
      console.error('PostgreSQL pool idle client error:', err instanceof Error ? err.message : err);
      if (poolInstance === pool) {
        poolInstance = null;
      }
    });
    poolInstance = pool;
  }
  return poolInstance;
}

export async function verifyDatabaseConnection(): Promise<{ ok: true; latencyMs: number }> {
  const startedAt = Date.now();
  try {
    await database().query('select 1');
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (firstErr) {
    await resetDatabasePool();
    await database().query('select 1');
    return { ok: true, latencyMs: Date.now() - startedAt };
  }
}
