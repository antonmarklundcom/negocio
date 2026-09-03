/**
 * Idempotent seed importer: the built-in dataset → MySQL.
 *
 *   export DATABASE_URL="mysql://user:pass@host:3306/db"   # tsx does NOT load .env
 *   npx tsx scripts/import-seed.ts --dry-run
 *   npx tsx scripts/import-seed.ts
 *
 * Keyed on `slug`, so re-running updates rather than duplicates. It refuses to
 * start without DATABASE_URL instead of importing half a dataset, and it runs
 * everything inside one transaction: a failure leaves the database exactly as
 * it was.
 *
 * Nothing about this script makes the database live — that is PR-2, which flips
 * `selectPrimary()` in lib/listings-repo.ts.
 */
import { eq, inArray } from 'drizzle-orm';
import { CATEGORIES } from '../lib/categories';
import { CITIES, CITY_COORDS } from '../lib/cities';
import { SEED_RAW } from '../lib/providers/seed-data';
import { createDb, createPool, databaseUrl, MissingDatabaseUrlError } from '../lib/db/connection';
import { categories, cities, listingGallery, listingHours, listings } from '../lib/db/schema';
import { dayHoursToRows } from '../lib/db/mappers';
import { computeSearchText } from '../lib/db/query-helpers';

type Counts = { categories: number; cities: number; listings: number; hours: number; gallery: number };

function parseArgs(argv: string[]): { dryRun: boolean } {
  const unknown = argv.filter((a) => a !== '--dry-run');
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(', ')}. Usage: import-seed.ts [--dry-run]`);
  }
  return { dryRun: argv.includes('--dry-run') };
}

/** Set once the import transaction has started, so errors say the right thing. */
let importStarted = false;

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));

  // Refuse before touching anything rather than importing half a dataset.
  if (!dryRun) databaseUrl();

  const counts: Counts = {
    categories: CATEGORIES.length,
    cities: CITIES.length,
    listings: SEED_RAW.length,
    hours: SEED_RAW.reduce((n, s) => n + dayHoursToRows(s.id, s.hours).length, 0),
    gallery: SEED_RAW.reduce((n, s) => n + (s.gallery?.length ?? 0), 0),
  };

  // Fail before touching anything if the dataset itself is inconsistent.
  const knownCategories = new Set(CATEGORIES.map((c) => c.slug));
  const knownCities = new Set(CITIES.map((c) => c.slug));
  const problems: string[] = [];
  const seenSlugs = new Set<string>();
  const seenIds = new Set<string>();
  for (const s of SEED_RAW) {
    if (!knownCategories.has(s.categoria)) problems.push(`${s.slug}: unknown categoria "${s.categoria}"`);
    if (!knownCities.has(s.ciudad)) problems.push(`${s.slug}: unknown ciudad "${s.ciudad}"`);
    if (seenSlugs.has(s.slug)) problems.push(`duplicate slug "${s.slug}"`);
    if (seenIds.has(s.id)) problems.push(`duplicate id "${s.id}"`);
    seenSlugs.add(s.slug);
    seenIds.add(s.id);
  }
  if (problems.length > 0) {
    console.error('Seed data is inconsistent; nothing was imported:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  console.info(
    `Seed: ${counts.categories} categories, ${counts.cities} cities, ${counts.listings} listings, ` +
      `${counts.hours} hour ranges, ${counts.gallery} gallery images.`,
  );

  if (dryRun) {
    console.info('--dry-run: nothing written.');
    return;
  }

  const pool = createPool(databaseUrl());
  const db = createDb(pool);

  try {
    importStarted = true;
    await db.transaction(async (tx) => {
      for (const [i, c] of CATEGORIES.entries()) {
        const row = {
          slug: c.slug,
          label: c.label,
          labelPlural: c.labelPlural,
          icon: c.icon,
          blockKind: c.blockKind,
          sortOrder: i,
        };
        await tx.insert(categories).values(row).onDuplicateKeyUpdate({
          set: {
            label: row.label,
            labelPlural: row.labelPlural,
            icon: row.icon,
            blockKind: row.blockKind,
            sortOrder: row.sortOrder,
          },
        });
      }

      for (const [i, c] of CITIES.entries()) {
        const coords = CITY_COORDS[c.slug];
        const row = {
          slug: c.slug,
          label: c.label,
          sortOrder: i,
          lat: coords ? String(coords.lat) : null,
          lng: coords ? String(coords.lng) : null,
        };
        await tx.insert(cities).values(row).onDuplicateKeyUpdate({
          set: { label: row.label, sortOrder: row.sortOrder, lat: row.lat, lng: row.lng },
        });
      }

      for (const s of SEED_RAW) {
        // The seed carries no per-business coordinates: the map falls back to
        // the city centre at render time (lib/db/mappers). Writing that
        // fallback here would turn a rendering default into a stored "fact".
        const values = {
          id: s.id,
          slug: s.slug,
          name: s.name,
          categoria: s.categoria,
          ciudad: s.ciudad,
          subtitle: s.subtitle ?? null,
          description: s.description ?? null,
          zona: s.zona ?? null,
          address: s.address ?? null,
          lat: s.lat !== undefined ? String(s.lat) : null,
          lng: s.lng !== undefined ? String(s.lng) : null,
          phone: s.phone ?? null,
          whatsapp: s.whatsapp ?? null,
          email: s.email ?? null,
          website: s.website ?? null,
          instagram: s.instagram ?? null,
          coverImage: s.coverImage ?? null,
          especialidades: s.especialidades ?? null,
          destacadoItem: s.destacadoItem ?? null,
          productos: s.productos ?? null,
          servicios: s.servicios ?? null,
          verified: s.verified,
          premiumUntil: s.premiumUntil ?? null,
          // `rating` and `reviewsCount` are deliberately ABSENT. As of Phase D
          // item 5 the `reviews` table owns those two columns: they are
          // recomputed from a listing's approved reviews on every moderation
          // decision. Writing them here — the seed carries no ratings, so it
          // would write NULL — meant a re-run of this idempotent importer
          // silently wiped a real, earned average.
          yearsActive: s.yearsActive ?? null,
          avgResponseMins: s.avgResponseMins ?? null,
          // ROADMAP F3 — kept in sync on every write, same as `listingToRow`.
          searchText: computeSearchText(s),
        };

        // `slug` is the natural key. The primary key is never updated, so an
        // existing row keeps the id its public URLs and leads already refer to.
        const { id: _id, slug: _slug, ...updatable } = values;
        await tx.insert(listings).values(values).onDuplicateKeyUpdate({ set: updatable });

        // Children are replaced wholesale: they are ordered/positional, so
        // upserting them row by row would leave removed ranges behind.
        const [existing] = await tx
          .select({ id: listings.id })
          .from(listings)
          .where(eq(listings.slug, s.slug))
          .limit(1);
        const listingId = existing?.id ?? s.id;

        await tx.delete(listingHours).where(eq(listingHours.listingId, listingId));
        const hourRows = dayHoursToRows(listingId, s.hours);
        if (hourRows.length > 0) await tx.insert(listingHours).values(hourRows);

        await tx.delete(listingGallery).where(eq(listingGallery.listingId, listingId));
        const galleryRows = (s.gallery ?? []).map((url, position) => ({ listingId, url, position }));
        if (galleryRows.length > 0) await tx.insert(listingGallery).values(galleryRows);
      }
    });

    const present = await db
      .select({ slug: listings.slug })
      .from(listings)
      .where(inArray(listings.slug, [...seenSlugs]));
    console.info(`Imported. ${present.length}/${SEED_RAW.length} seed listings present in the database.`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  if (err instanceof MissingDatabaseUrlError) {
    console.error(err.message);
  } else {
    console.error(importStarted ? 'Import failed; the transaction was rolled back.' : 'Import aborted.');
    console.error(err instanceof Error ? err.message : err);
  }
  process.exitCode = 1;
});
