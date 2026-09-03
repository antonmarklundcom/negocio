/**
 * One-off backfill for `listings.search_text` (ROADMAP F3).
 *
 * The migration that adds the column cannot populate it: MySQL has no
 * NFD-normalize function, so every existing row needs `computeSearchText`
 * run in the app and written back. New rows do not need this — every write
 * path (`lib/db/mappers.ts`'s `listingToRow`, `lib/db/listings-admin.ts`'s
 * `createListing`/`updateListing`, `scripts/import-seed.ts`) already computes
 * `search_text` itself.
 *
 *   export DATABASE_URL="mysql://user:pass@host:3306/db"   # tsx does NOT load .env
 *   npx tsx scripts/backfill-search-text.ts --dry-run
 *   npx tsx scripts/backfill-search-text.ts
 *
 * Idempotent and safe to re-run: it recomputes `search_text` for every row
 * from its current name/subtitle/description/zona and only writes rows whose
 * value would actually change, so a second run touches nothing.
 *
 * Run this ONCE, right after applying the migration that adds `search_text`
 * (`npm run db:migrate`) and BEFORE relying on search — until it runs, every
 * existing listing has `search_text = NULL` and free-text search finds
 * nothing for it.
 */
import { eq } from 'drizzle-orm';
import { createDb, createPool, databaseUrl, MissingDatabaseUrlError } from '../lib/db/connection';
import { listings } from '../lib/db/schema';
import { computeSearchText } from '../lib/db/query-helpers';

function parseArgs(argv: string[]): { dryRun: boolean } {
  const unknown = argv.filter((a) => a !== '--dry-run');
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(', ')}. Usage: backfill-search-text.ts [--dry-run]`);
  }
  return { dryRun: argv.includes('--dry-run') };
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));

  // Refuse before touching anything rather than backfilling half a table.
  databaseUrl();

  const pool = createPool(databaseUrl());
  const db = createDb(pool);

  try {
    const rows = await db
      .select({
        id: listings.id,
        name: listings.name,
        subtitle: listings.subtitle,
        description: listings.description,
        zona: listings.zona,
        searchText: listings.searchText,
      })
      .from(listings);

    let toUpdate = 0;
    for (const row of rows) {
      const next = computeSearchText(row);
      if (next === (row.searchText ?? '')) continue;
      toUpdate += 1;
      if (!dryRun) {
        await db.update(listings).set({ searchText: next }).where(eq(listings.id, row.id));
      }
    }

    if (dryRun) {
      console.info(`--dry-run: ${toUpdate}/${rows.length} listing(s) would be updated. Nothing written.`);
    } else {
      console.info(`Backfilled search_text for ${toUpdate}/${rows.length} listing(s).`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  if (err instanceof MissingDatabaseUrlError) {
    console.error(err.message);
  } else {
    console.error('Backfill failed.');
    console.error(err instanceof Error ? err.message : err);
  }
  process.exitCode = 1;
});
