import 'server-only';
import type { Pool } from 'mysql2/promise';
import { createDb, createPool, databaseUrl, type Db } from './connection';

/**
 * The application's single Drizzle instance. Server-only: a client component
 * that imports this fails the build instead of leaking the connection string.
 *
 * The pool is created lazily on first query, not at module load. `next build`
 * imports every module it renders, and a build machine legitimately has no
 * DATABASE_URL — connecting at import time would turn "no database configured"
 * into a failed build rather than a clear runtime error.
 */

let pool: Pool | undefined;
let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    pool = createPool(databaseUrl());
    db = createDb(pool);
  }
  return db;
}

/** True when a connection string is configured. Never connects. */
export function dbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

/** For scripts and tests that need to let the process exit. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
