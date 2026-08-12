import { and, asc, desc, eq, exists, inArray, like, or, sql, type SQL } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/mysql-core';
import type { ListingQuery } from '../types';
import { listingHours, listings } from './schema';
import { likePattern, sortPlan, taxonomySlugsMatching } from './query-helpers';
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

export function buildListingWhere(params: ListingQuery, at: WallClock): SQL | undefined {
  const conditions: SQL[] = [];

  if (params.categoria) conditions.push(eq(listings.categoria, params.categoria));
  if (params.ciudad) conditions.push(eq(listings.ciudad, params.ciudad));
  if (params.zona) {
    conditions.push(sql`lower(${listings.zona}) = ${params.zona.trim().toLowerCase()}`);
  }
  if (params.abierto) conditions.push(openNowSql(at));

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

  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

/** Mirrors the ordering in lib/providers/query.ts so seed and DB agree. */
export function buildListingOrderBy(params: ListingQuery, nowSeconds: number): SQL[] {
  const plan = sortPlan(params);
  const order: SQL[] = [];
  if (plan.premiumFirst) order.push(desc(isPremiumSql(nowSeconds)));
  if (plan.verifiedFirst) order.push(desc(listings.verified));
  order.push(asc(listings.name));
  return order;
}
