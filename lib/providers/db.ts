import 'server-only';
import { asc, count, eq, exists, inArray, sql } from 'drizzle-orm';
import type { ListingsProvider } from './types';
import type {
  Category,
  CategoryCityCombo,
  City,
  Listing,
  ListingQuery,
  ListingResult,
} from '../types';
import { getDb } from '../db/client';
import { categories, cities, listingGallery, listingHours, listings } from '../db/schema';
import { rowToCategory, rowToCity, rowToListing } from '../db/mappers';
import { pagination } from '../db/query-helpers';
import { buildListingOrderBy, buildListingWhere } from '../db/listing-query';
import { wallClockNow } from '../db/open-now';

/**
 * The MySQL provider (§5.1). Together with `lib/db/` it is the only place in
 * the app that contains SQL; everything it returns is a plain
 * `Listing`/`Category`/`City`.
 *
 * Unlike the seed provider it does NOT materialise every listing and filter in
 * memory: filtering, sorting and pagination are pushed into SQL and only the
 * current page's rows (plus their children) are read.
 *
 * Selected by `selectPrimary()` in lib/listings-repo whenever `DATABASE_URL`
 * is set (PR-2).
 */

type HoursRow = { listingId: string; day: number; openMinute: number; closeMinute: number };
type GalleryRow = { listingId: string; url: string; position: number };

/** Hours and gallery for a page of listings, one query each — never N+1. */
async function loadChildren(listingIds: string[]): Promise<{
  hours: Map<string, HoursRow[]>;
  gallery: Map<string, GalleryRow[]>;
}> {
  if (listingIds.length === 0) return { hours: new Map(), gallery: new Map() };

  const db = getDb();
  const [hourRows, galleryRows] = await Promise.all([
    db
      .select({
        listingId: listingHours.listingId,
        day: listingHours.day,
        openMinute: listingHours.openMinute,
        closeMinute: listingHours.closeMinute,
      })
      .from(listingHours)
      .where(inArray(listingHours.listingId, listingIds)),
    db
      .select({
        listingId: listingGallery.listingId,
        url: listingGallery.url,
        position: listingGallery.position,
      })
      .from(listingGallery)
      .where(inArray(listingGallery.listingId, listingIds)),
  ]);

  return { hours: groupByListing(hourRows), gallery: groupByListing(galleryRows) };
}

function groupByListing<T extends { listingId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = map.get(row.listingId);
    if (bucket) bucket.push(row);
    else map.set(row.listingId, [row]);
  }
  return map;
}

export const dbProvider: ListingsProvider = {
  name: 'mysql',

  async getListings(params: ListingQuery): Promise<ListingResult> {
    const db = getDb();
    const where = buildListingWhere(params, wallClockNow());
    const orderBy = buildListingOrderBy(params, Math.floor(Date.now() / 1000));
    const { limit, offset } = pagination(params);

    const [rows, totals] = await Promise.all([
      db.select().from(listings).where(where).orderBy(...orderBy).limit(limit).offset(offset),
      db.select({ total: count() }).from(listings).where(where),
    ]);

    const children = await loadChildren(rows.map((r) => r.id));
    const items: Listing[] = rows.map((row) =>
      rowToListing(row, {
        hours: children.hours.get(row.id) ?? [],
        gallery: children.gallery.get(row.id) ?? [],
      }),
    );

    return { items, total: totals[0]?.total ?? 0 };
  },

  async getListingBySlug(slug: string): Promise<Listing | null> {
    const db = getDb();
    const [row] = await db.select().from(listings).where(eq(listings.slug, slug)).limit(1);
    if (!row) return null;

    const children = await loadChildren([row.id]);
    return rowToListing(row, {
      hours: children.hours.get(row.id) ?? [],
      gallery: children.gallery.get(row.id) ?? [],
    });
  },

  /** Only categories that actually have a listing — never advertise an empty rubro. */
  async getCategories(): Promise<Category[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(categories)
      .where(
        exists(
          db
            .select({ one: sql`1` })
            .from(listings)
            .where(eq(listings.categoria, categories.slug)),
        ),
      )
      .orderBy(asc(categories.sortOrder), asc(categories.label));
    return rows.map(rowToCategory);
  },

  async getCities(): Promise<City[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(cities)
      .where(
        exists(
          db
            .select({ one: sql`1` })
            .from(listings)
            .where(eq(listings.ciudad, cities.slug)),
        ),
      )
      .orderBy(asc(cities.sortOrder), asc(cities.label));
    return rows.map(rowToCity);
  },

  async getCategoryCityCombosWithListings(): Promise<CategoryCityCombo[]> {
    const db = getDb();
    const rows = await db
      .select({ categoria: listings.categoria, ciudad: listings.ciudad, count: count() })
      .from(listings)
      .groupBy(listings.categoria, listings.ciudad);

    return rows.map((r) => ({ categoria: r.categoria, ciudad: r.ciudad, count: r.count }));
  },
};

/** True when a connection string is configured. PR-2 uses this in selectPrimary(). */
export { dbConfigured } from '../db/client';
