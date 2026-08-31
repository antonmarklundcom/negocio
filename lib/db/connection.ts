import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './schema';

/**
 * The pool factory. Deliberately NOT marked `server-only`: `scripts/*.ts` run
 * under `tsx` in plain Node and need a connection too, and importing a
 * `server-only` module from Node throws. Application code must import
 * `lib/db/client.ts` instead, which adds that guard.
 */

export type Db = MySql2Database<typeof schema>;

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super(
      'DATABASE_URL is not set. Expected mysql://user:password@host:3306/database ' +
        '(Hostinger: hPanel → Databases → Remote MySQL, and whitelist the app host). ' +
        'Note that tsx does NOT load .env — export it in the shell before running scripts.',
    );
    this.name = 'MissingDatabaseUrlError';
  }
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new MissingDatabaseUrlError();
  return url;
}

/**
 * Hostinger's MySQL caps concurrent connections per user, so the pool stays
 * small. `timezone: 'Z'` keeps DATETIME round-trips in UTC — nothing in this
 * app reads wall-clock time from MySQL (see `lib/db/open-now.ts`), and this
 * makes sure it cannot start doing so by accident.
 */
export function createPool(url: string = databaseUrl()): mysql.Pool {
  return mysql.createPool({
    uri: url,
    connectionLimit: 8,
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: false,
    // A request that can't get a connection must fail in seconds so its process is
    // released, rather than hang forever and eat into Hostinger's shared process cap.
    waitForConnections: true,
    queueLimit: 24,
    connectTimeout: 8_000,
  });
}

export function createDb(pool: mysql.Pool): Db {
  return drizzle(pool, { schema, mode: 'default' });
}

export { schema };
