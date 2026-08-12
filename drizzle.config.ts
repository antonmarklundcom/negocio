import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are GENERATED into ./drizzle in the repo and APPLIED from a local
 * machine (`npm run db:push` / `drizzle-kit migrate`), never from a web session
 * or a deploy hook. Any PR whose code needs a column must land after that
 * column has been applied, or it deploys and 500s.
 */
export default defineConfig({
  dialect: 'mysql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
