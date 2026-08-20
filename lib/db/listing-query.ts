import { and, asc, desc, eq, exists, inArray, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/mysql-core';
import type { ListingQuery } from '../types';
import { listingHours, listings } from './schema';
import { likePattern, sortPlan, taxonomySlugsMatching } from './query-helpers';
import { lngScaleAt, type Point } from '../geo';
import { previousDay, type WallClock } from './open-now';

/**
 * The WHERE and ORDER BY behind `lib/providers/db.ts`, built without a
 * connection so both can be unit-tested with no MySQL running. The provider
 * owns the I/O; this module owns the meaning of a `ListingQuery`.
 */

/** Standalone builder — subqueries do not need a live connection to be composed. */
const qb = new QueryBuilder();

/** Premium is a point-in-time fact; the app supplies the instant, never MySQL. */
export function isPremiumSql(nowSeconds: number): SQL<boolean> {
  return sql<boolean>`(${listings.premiumUntil} is not null and ${listings.premiumUntil} > ${nowSeconds})`;
}

/** "Destacado en portada" (Phase D item 3) — same point-in-time shape as `isPremiumSql`, a separate paid slot. */
export function isFeaturedSql(nowSeconds: number): SQL<boolean> {
  return sql<boolean>`(${listings.featuredUntil} is not null and ${listings.featuredUntil} > ${nowSeconds})`;
}

/**
 * "Abierto ahora", mirroring `isRangeOpenAt` in ./open-now.ts one-for-one:
 * a range open today, a range that started today and runs past midnight, or a
 * range that started yesterday and has not closed yet. Day and minute are
 * `America/Asuncion` wall clock computed in the app — the MySQL server's own
 * timezone is never consulted.
 */
export function openNowSql(at: WallClock): SQL<unknown> {
  const yesterday = previousDay(at.day);
  const minutes = at.minutes;

  return exists(
    qb
      .select({ one: sql`1` })
      .from(listingHours)
      .where(
        and(
          eq(listingHours.listingId, listings.id),
          or(
            sql`(${listingHours.day} = ${at.day} and ${listingHours.closeMinute} > ${listingHours.openMinute} and ${minutes} >= ${listingHours.openMinute} and ${minutes} < ${listingHours.closeMinute})`,
            sql`(${listingHours.day} = ${at.day} and ${listingHours.closeMinute} <= ${listingHours.openMinute} and ${minutes} >= ${listingHours.openMinute})`,
            sql`(${listingHours.day} = ${yesterday} and ${listingHours.closeMinute} <= ${listingHours.openMinute} and ${minutes} < ${listingHours.closeMinute})`,
          ),
        ),
      ),
  );
}

/**
 * Only `published` rows are ever public (ROADMAP W2-1 / D2).
 *
 * This lives at the top of `buildListingWhere` rather than at each call site
 * because `buildListingWhere` IS the public read path: every listing query the
 * site makes goes through it, so a new caller cannot forget the filter. The
 * admin does not use this builder at all — `lib/db/listings-admin.ts` has its
 * own, which is how staff still see drafts and archived rows.
 */
export const PUBLIC_STATUS_CONDITION = () => eq(listings.status, 'published');

export function buildListingWhere(params: ListingQuery, at: WallClock, nowSeconds: number): SQL | undefined {
  const conditions: SQL[] = [PUBLIC_STATUS_CONDITION()];

  if (params.excludeId) conditions.push(ne(listings.id, params.excludeId));
  // An empty `slugs` array means "match nothing", not "match everything".
  // `inArray` with no values is not reliably a false condition, and getting it
  // wrong here turns an empty favorites list into the entire directory — so the
  // empty case is spelled out rather than left to the query builder.
  if (params.slugs) {
    conditions.push(params.slugs.length > 0 ? inArray(listings.slug, params.slugs) : sql`1 = 0`);
  }
  if (params.categoria) conditions.push(eq(listings.categoria, params.categoria));
  if (params.ciudad) conditions.push(eq(listings.ciudad, params.ciudad));
  if (params.zona) {
    conditions.push(sql`lower(${listings.zona}) = ${params.zona.trim().toLowerCase()}`);
  }
  if (params.abierto) conditions.push(openNowSql(at));
  if (params.destacado) conditions.push(isFeaturedSql(nowSeconds));

  const q = params.q?.trim();
  if (q) {
    const pattern = likePattern(q);
    const { categorias, ciudades } = taxonomySlugsMatching(q);
    const textMatches: SQL[] = [
      like(listings.name, pattern),
      like(listings.subtitle, pattern),
      like(listings.description, pattern),
      like(listings.zona, pattern),
    ];
    // Category and city labels are derived from the static taxonomy rather than
    // stored on the row, so they are matched as slugs instead of joined.
    if (categorias.length > 0) textMatches.push(inArray(listings.categoria, categorias));
    if (ciudades.length > 0) textMatches.push(inArray(listings.ciudad, ciudades));
    const textMatch = or(...textMatches);
    if (textMatch) conditions.push(textMatch);
  }

  // Never `undefined`: the status filter is always present, so a caller that
  // passes no parameters still gets published rows only.
  return and(...conditions);
}

/**
 * Squared planar distance from `near`, in squared degrees, for ORDER BY only
 * (ROADMAP W3-1).
 *
 * Squared, because the square root is monotonic and ordering does not need it.
 * `lngScaleAt` is evaluated **in the app** and bound as a plain number, so the
 * expression mirrors `approxDistanceKm` in `lib/geo.ts` exactly and MySQL is
 * never asked to do trigonometry — the same reason `isPremiumSql` takes the
 * instant as a parameter instead of calling `NOW()`.
 */
export function distanceSql(near: Point): SQL<number> {
  const scale = lngScaleAt(near.lat);
  return sql<number>`(
    (${listings.lat} - ${near.lat}) * (${listings.lat} - ${near.lat})
    + (${listings.lng} - ${near.lng}) * (${listings.lng} - ${near.lng}) * ${scale} * ${scale}
  )`;
}

/** Mirrors the ordering in lib/providers/query.ts so seed and DB agree. */
export function buildListingOrderBy(params: ListingQuery, nowSeconds: number): SQL[] {
  const plan = sortPlan(params);
  const order: SQL[] = [];
  if (plan.premiumFirst) order.push(desc(isPremiumSql(nowSeconds)));
  if (plan.verifiedFirst) order.push(desc(listings.verified));
  if (plan.ratingFirst) {
    // Unrated is not zero-rated: NULLs go after every rated row. MySQL sorts
    // NULLs first ascending, so the explicit `is null` key does it rather than
    // a COALESCE that would quietly invent a rating.
    order.push(asc(sql`(${listings.rating} is null)`));
    order.push(desc(listings.rating));
  }
  if (plan.distanceFirst && params.near) {
    // Same shape for a listing nobody has geocoded — last, not nearest.
    order.push(asc(sql`(${listings.lat} is null or ${listings.lng} is null)`));
    order.push(asc(distanceSql(params.near)));
  }
  order.push(asc(listings.name));
  return order;
}
