import { CATEGORIES } from '../categories';
import { CITIES } from '../cities';
import { DEFAULT_PAGE_SIZE } from '../config';
import type { ListingQuery } from '../types';

/**
 * Pure helpers behind the SQL in `lib/providers/db.ts`. They hold every rule
 * that is easy to get wrong (LIKE escaping, page bounds, which sort a query
 * means) in functions that can be tested without a database.
 */

/** Largest page a caller may ask for, so `?pageSize=100000` cannot be used to scan the table. */
export const MAX_PAGE_SIZE = 60;

/**
 * Escape the characters MySQL's LIKE treats as wildcards. Without this, a
 * visitor searching for "100%" matches every listing.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** A `%term%` pattern with wildcards in the term itself neutralised. */
export function likePattern(term: string): string {
  return `%${escapeLike(term)}%`;
}

export type Pagination = { page: number; pageSize: number; limit: number; offset: number };

export function pagination(params: Pick<ListingQuery, 'page' | 'pageSize'>): Pagination {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const requested = Math.floor(params.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

/**
 * Free-text search also has to match the *labels* a visitor sees ("Restaurante",
 * "Asunción"), but those labels are derived from the static taxonomy rather
 * than stored on the row. So resolve the term to taxonomy slugs here and let
 * the query add them as an OR — no join, and the labels stay in one place.
 */
export function taxonomySlugsMatching(term: string): { categorias: string[]; ciudades: string[] } {
  const needle = normalize(term);
  if (!needle) return { categorias: [], ciudades: [] };
  return {
    categorias: CATEGORIES.filter(
      (c) => normalize(c.label).includes(needle) || normalize(c.labelPlural).includes(needle),
    ).map((c) => c.slug),
    ciudades: CITIES.filter((c) => normalize(c.label).includes(needle)).map((c) => c.slug),
  };
}

/** Lowercase and strip accents, so "asuncion" finds "Asunción". */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export type SortPlan = {
  /** Premium listings before free ones. */
  premiumFirst: boolean;
  /** Verified before unverified (relevancia only). */
  verifiedFirst: boolean;
  /** Rated listings before unrated, then rating descending (ROADMAP W3-1). */
  ratingFirst: boolean;
  /** Nearest first, using `params.near` (ROADMAP W3-1). */
  distanceFirst: boolean;
};

/**
 * Which ordering a `ListingQuery` means, mirroring `lib/providers/query.ts` so
 * seed and DB results are ordered identically:
 *   nombre        → name only
 *   destacados    → premium, then name
 *   calificacion  → rated before unrated, rating desc, then name
 *   cerca         → nearest first, un-geocoded last, then name
 *   relevancia    → premium (when asked), then verified, then name
 *
 * `cerca` without a point is `relevancia`. That is the same call the in-memory
 * engine makes: a visitor who declined the browser's location prompt gets the
 * normal ordering, not an empty page and not an arbitrary one.
 */
export function sortPlan(params: Pick<ListingQuery, 'sort' | 'premiumFirst' | 'near'>): SortPlan {
  const base = { premiumFirst: false, verifiedFirst: false, ratingFirst: false, distanceFirst: false };
  const sort = params.sort ?? 'relevancia';
  if (sort === 'nombre') return base;
  if (sort === 'destacados') return { ...base, premiumFirst: true };
  if (sort === 'calificacion') return { ...base, ratingFirst: true };
  if (sort === 'cerca' && params.near) return { ...base, distanceFirst: true };
  return { ...base, premiumFirst: params.premiumFirst ?? true, verifiedFirst: true };
}
