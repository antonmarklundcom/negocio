import type { Listing, ListingQuery } from './types';

/**
 * "Negocios similares" (ROADMAP W3-1) — which listings a detail page should
 * offer next, and in what order.
 *
 * Pure, and separate from the page, for the usual reason: the interesting part
 * is the *ranking policy*, not the fetch. Ranking is worth getting right
 * because this block is both the conversion path for a visitor who bounced off
 * one business and the internal-linking surface a directory lives on — every
 * detail page currently links out to exactly one category page and nothing else.
 */

/** How many similar businesses a detail page shows. */
export const SIMILAR_LIMIT = 4;

/**
 * How many candidates to read before ranking. Deliberately larger than
 * `SIMILAR_LIMIT`: the same-barrio preference below can only prefer what it was
 * given, and a category with one busy barrio would otherwise never surface it.
 */
export const SIMILAR_CANDIDATES = 24;

/**
 * The query for a listing's candidates: same rubro, same city, never itself.
 *
 * City rather than barrio, with barrio applied as a *preference* in
 * `rankSimilar` instead of a filter. A barrio filter returns nothing at all for
 * the many listings whose `zona` is blank — `zona` is free text an editor typed,
 * not a controlled vocabulary — and an empty block is worse than a slightly
 * looser one.
 */
export function similarQuery(listing: Listing): ListingQuery {
  return {
    categoria: listing.categoria,
    ciudad: listing.ciudad,
    excludeId: listing.id,
    page: 1,
    pageSize: SIMILAR_CANDIDATES,
  };
}

/** Case- and accent-insensitive barrio comparison; blank never matches blank. */
function sameZona(a: Listing, b: Listing): boolean {
  const norm = (z?: string) =>
    z?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';
  const za = norm(a.zona);
  return za !== '' && za === norm(b.zona);
}

/**
 * Rank candidates for `listing` and take the top `limit`.
 *
 * Same barrio first, then whatever order the provider returned — which is
 * already `relevancia` (premium, then verified, then name), so a paid listing
 * keeps its advantage inside each group without this function re-deriving what
 * "premium" means. The sort is stable, so equal keys preserve that order.
 */
export function rankSimilar(listing: Listing, candidates: Listing[], limit = SIMILAR_LIMIT): Listing[] {
  return [...candidates]
    .filter((c) => c.id !== listing.id)
    .sort((a, b) => Number(sameZona(listing, b)) - Number(sameZona(listing, a)))
    .slice(0, limit);
}
