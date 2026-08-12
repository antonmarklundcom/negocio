/**
 * Parity check: the MySQL provider against the seed provider.
 *
 *   export DATABASE_URL="mysql://user:pass@host:3306/db"   # tsx does NOT load .env
 *   npm run db:verify
 *
 * Every test in tests/ is pure — they prove the mapping and the shape of the
 * SQL, not that MySQL accepts it. This script is the other half: it runs every
 * ListingsProvider method against the real database and compares the answers to
 * the seed provider, which is the dataset that was imported. Run it after
 * `npm run db:import-seed` and before the cutover PR flips selectPrimary(), so
 * a Drizzle or collation surprise shows up here instead of as a 500 in
 * production.
 *
 * READ-ONLY: it never writes. Exits non-zero if any check fails.
 */
import { isDeepStrictEqual } from 'node:util';
import { dbProvider } from '../lib/providers/db';
import { seedProvider } from '../lib/providers/seed';
import { SEED_LISTINGS } from '../lib/providers/seed-data';
import { closeDb } from '../lib/db/client';
import { databaseUrl, MissingDatabaseUrlError } from '../lib/db/connection';
import { MAX_PAGE_SIZE } from '../lib/db/query-helpers';
import type { Listing, ListingQuery } from '../lib/types';

let failures = 0;
let warnings = 0;

function pass(label: string, detail = ''): void {
  console.info(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label: string, expected: unknown, actual: unknown): void {
  failures++;
  console.error(`  FAIL  ${label}`);
  console.error(`        seed: ${preview(expected)}`);
  console.error(`        db:   ${preview(actual)}`);
}

function warn(label: string, detail: string): void {
  warnings++;
  console.warn(`  warn  ${label} — ${detail}`);
}

function preview(value: unknown): string {
  const text = JSON.stringify(value);
  if (!text) return String(value);
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

function expectEqual(label: string, expected: unknown, actual: unknown): boolean {
  if (isDeepStrictEqual(expected, actual)) {
    pass(label);
    return true;
  }
  fail(label, expected, actual);
  return false;
}

/** Read every page, so a 33-row dataset is compared in full. */
async function allListings(
  provider: { getListings(p: ListingQuery): Promise<{ items: Listing[]; total: number }> },
  params: ListingQuery,
): Promise<Listing[]> {
  const items: Listing[] = [];
  for (let page = 1; page <= 50; page++) {
    const result = await provider.getListings({ ...params, page, pageSize: MAX_PAGE_SIZE });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) break;
  }
  return items;
}

const slugsOf = (items: Listing[]): string[] => items.map((l) => l.slug);
const sortedSlugs = (items: Listing[]): string[] => [...slugsOf(items)].sort();

async function checkTaxonomies(): Promise<void> {
  console.info('\nTaxonomies');
  expectEqual(
    'getCategories() returns the same rubros',
    (await seedProvider.getCategories()).map((c) => c.slug),
    (await dbProvider.getCategories()).map((c) => c.slug),
  );
  expectEqual(
    'getCategories() keeps labels, icons and blockKind intact',
    await seedProvider.getCategories(),
    await dbProvider.getCategories(),
  );
  expectEqual(
    'getCities() returns the same cities',
    (await seedProvider.getCities()).map((c) => c.slug),
    (await dbProvider.getCities()).map((c) => c.slug),
  );

  const key = (c: { categoria: string; ciudad: string; count: number }) =>
    `${c.categoria}|${c.ciudad}=${c.count}`;
  expectEqual(
    'getCategoryCityCombosWithListings() matches (drives the SEO pages and the sitemap)',
    (await seedProvider.getCategoryCityCombosWithListings()).map(key).sort(),
    (await dbProvider.getCategoryCityCombosWithListings()).map(key).sort(),
  );
}

async function checkFullSet(): Promise<Listing[]> {
  console.info('\nThe full listing set');
  const seed = await allListings(seedProvider, {});
  const db = await allListings(dbProvider, {});

  expectEqual(`every listing imported (${seed.length} expected)`, sortedSlugs(seed), sortedSlugs(db));

  const totals = await Promise.all([
    seedProvider.getListings({ pageSize: 1 }),
    dbProvider.getListings({ pageSize: 1 }),
  ]);
  expectEqual('total count agrees', totals[0]?.total, totals[1]?.total);

  return seed;
}

/**
 * Field-by-field on every listing. A wrong column mapping is silent until
 * someone looks at a page, which is exactly the failure this catches.
 */
async function checkEveryListing(seed: Listing[]): Promise<void> {
  console.info('\nEvery listing, field by field');
  let mismatched = 0;
  const missing: string[] = [];

  for (const expected of seed) {
    const actual = await dbProvider.getListingBySlug(expected.slug);
    if (!actual) {
      missing.push(expected.slug);
      continue;
    }
    const differing = (Object.keys(expected) as (keyof Listing)[]).filter(
      (field) => !isDeepStrictEqual(expected[field], actual[field]),
    );
    if (differing.length > 0) {
      mismatched++;
      failures++;
      console.error(`  FAIL  ${expected.slug}: ${differing.join(', ')}`);
      for (const field of differing) {
        console.error(`        ${field} seed: ${preview(expected[field])}`);
        console.error(`        ${field} db:   ${preview(actual[field])}`);
      }
    }
  }

  if (missing.length > 0) {
    failures++;
    console.error(`  FAIL  getListingBySlug() returned null for: ${missing.join(', ')}`);
  }
  if (mismatched === 0 && missing.length === 0) {
    pass(`all ${seed.length} listings identical`, 'hours, gallery, category block, flags');
  }

  const absent = await dbProvider.getListingBySlug('no-such-negocio-slug');
  if (absent === null) pass('an unknown slug returns null, not a throw');
  else fail('an unknown slug returns null', null, absent);
}

async function checkFilters(): Promise<void> {
  console.info('\nFilters');
  const cases: { label: string; params: ListingQuery }[] = [
    { label: 'categoria=restaurantes', params: { categoria: 'restaurantes' } },
    { label: 'ciudad=asuncion', params: { ciudad: 'asuncion' } },
    { label: 'categoria + ciudad', params: { categoria: 'restaurantes', ciudad: 'asuncion' } },
    { label: 'zona=Villa Morra (case-insensitive)', params: { zona: 'villa morra' } },
    { label: 'q=parrilla (free text)', params: { q: 'parrilla' } },
    { label: 'q=Asunción (matches the city label)', params: { q: 'Asunción' } },
    { label: 'q=100% (LIKE wildcards escaped)', params: { q: '100%' } },
  ];

  for (const { label, params } of cases) {
    const seed = await allListings(seedProvider, params);
    const db = await allListings(dbProvider, params);
    if (isDeepStrictEqual(sortedSlugs(seed), sortedSlugs(db))) pass(label, `${seed.length} rows`);
    else fail(label, sortedSlugs(seed), sortedSlugs(db));
  }
}

/**
 * The open-now filter is the one piece of SQL that reimplements a JS rule, so
 * it gets its own check against the live clock.
 */
async function checkOpenNow(): Promise<void> {
  console.info('\nAbierto ahora (SQL mirroring lib/db/open-now.ts)');
  const seed = await allListings(seedProvider, { abierto: true });
  const db = await allListings(dbProvider, { abierto: true });

  if (isDeepStrictEqual(sortedSlugs(seed), sortedSlugs(db))) {
    pass('open-now set matches', `${seed.length} open right now in Asunción`);
    if (seed.length === 0) {
      warn(
        'nothing is open at this hour',
        'the check passed but proved little — re-run during business hours in Asunción',
      );
    }
  } else {
    fail('open-now set matches', sortedSlugs(seed), sortedSlugs(db));
  }
}

async function checkSortingAndPaging(): Promise<void> {
  console.info('\nSorting and pagination');

  for (const sort of ['relevancia', 'destacados', 'nombre'] as const) {
    const seed = await allListings(seedProvider, { sort });
    const db = await allListings(dbProvider, { sort });

    if (!isDeepStrictEqual(sortedSlugs(seed), sortedSlugs(db))) {
      fail(`sort=${sort} returns the same rows`, sortedSlugs(seed), sortedSlugs(db));
      continue;
    }
    if (isDeepStrictEqual(slugsOf(seed), slugsOf(db))) {
      pass(`sort=${sort} order identical`);
    } else {
      // MySQL's collation and Spanish localeCompare disagree about ñ/accents.
      // Same rows in a slightly different order is a cosmetic difference; the
      // premium/verified tiers below are the part that pays the bills.
      warn(`sort=${sort} order differs from the seed`, 'collation vs localeCompare — compare below');
      console.warn(`        seed: ${preview(slugsOf(seed).slice(0, 8))}`);
      console.warn(`        db:   ${preview(slugsOf(db).slice(0, 8))}`);
    }
  }

  // Premium listings must lead, whatever the collation does inside a tier.
  const now = Date.now() / 1000;
  const isPremium = (l: Listing) => !!l.premiumUntil && l.premiumUntil > now;
  const relevancia = await allListings(dbProvider, { sort: 'relevancia' });
  const firstFree = relevancia.findIndex((l) => !isPremium(l));
  const lastPremium = relevancia.map(isPremium).lastIndexOf(true);
  if (firstFree === -1 || lastPremium < firstFree) {
    pass('premium listings lead on sort=relevancia');
  } else {
    fail('premium listings lead on sort=relevancia', 'premium block first', slugsOf(relevancia).slice(0, 8));
  }

  const page1 = await dbProvider.getListings({ page: 1, pageSize: 5 });
  const page2 = await dbProvider.getListings({ page: 2, pageSize: 5 });
  if (page1.items.length === 5 && page2.items.length > 0) pass('pagination returns full pages');
  else fail('pagination returns full pages', '5 then more', [page1.items.length, page2.items.length]);

  const overlap = slugsOf(page1.items).filter((s) => slugsOf(page2.items).includes(s));
  if (overlap.length === 0) pass('page 1 and page 2 do not overlap');
  else fail('page 1 and page 2 do not overlap', [], overlap);

  const capped = await dbProvider.getListings({ pageSize: 100_000 });
  if (capped.items.length <= MAX_PAGE_SIZE) pass(`page size capped at ${MAX_PAGE_SIZE}`);
  else fail('page size capped', `<= ${MAX_PAGE_SIZE}`, capped.items.length);
}

async function main(): Promise<void> {
  databaseUrl(); // refuse before connecting to nothing

  console.info(`Verifying the MySQL provider against ${SEED_LISTINGS.length} seed listings.`);
  console.info('Read-only: this script never writes.');

  try {
    await checkTaxonomies();
    const seed = await checkFullSet();
    await checkEveryListing(seed);
    await checkFilters();
    await checkOpenNow();
    await checkSortingAndPaging();
  } finally {
    await closeDb();
  }

  console.info('');
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED. Do not flip the provider until these are green.`);
    process.exitCode = 1;
    return;
  }
  console.info(
    warnings > 0
      ? `All checks passed, with ${warnings} warning(s) to read above.`
      : 'All checks passed. The database serves exactly what the seed provider does.',
  );
}

main().catch((err: unknown) => {
  if (err instanceof MissingDatabaseUrlError) {
    console.error(err.message);
  } else {
    console.error('Verification could not run:');
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  }
  process.exitCode = 1;
});
