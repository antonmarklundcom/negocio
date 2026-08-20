import type { CategoryCityCombo, CategoryCityZonaCombo, Listing, ListingQuery, ListingResult } from '../types';
import { isFeatured, isPremium } from '../listing';
import { computeOpenState } from '../hours';
import { approxDistanceKm, isValidPoint, type Point } from '../geo';
import { DEFAULT_PAGE_SIZE } from '../config';

/**
 * Pure, in-memory query engine used by the seed provider, which materialises
 * the full listing set. Keeping it here means filtering/sorting/pagination
 * behave identically regardless of source.
 */
export function applyQuery(all: Listing[], params: ListingQuery): ListingResult {
  const q = params.q?.trim().toLowerCase();
  let items = all.filter((l) => {
    if (params.excludeId && l.id === params.excludeId) return false;
    if (params.categoria && l.categoria !== params.categoria) return false;
    if (params.ciudad && l.ciudad !== params.ciudad) return false;
    if (params.zona && (l.zona ?? '').toLowerCase() !== params.zona.toLowerCase()) return false;
    if (params.abierto) {
      const state = computeOpenState(l.hours);
      if (!('open' in state) || !state.open) return false;
    }
    if (params.destacado && !isFeatured(l)) return false;
    if (q) {
      const hay = `${l.name} ${l.categoriaLabel} ${l.ciudadLabel} ${l.zona ?? ''} ${l.subtitle ?? ''} ${
        l.description ?? ''
      }`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  items = sortListings(items, params.sort ?? 'relevancia', params.premiumFirst ?? true, params.near);

  const total = items.length;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total };
}

function sortListings(
  items: Listing[],
  sort: NonNullable<ListingQuery['sort']>,
  premiumFirst: boolean,
  near?: Point,
): Listing[] {
  const byName = (a: Listing, b: Listing) => a.name.localeCompare(b.name, 'es');
  const premiumRank = (l: Listing) => (isPremium(l) ? 0 : 1);

  const sorted = [...items];
  if (sort === 'nombre') {
    sorted.sort(byName);
  } else if (sort === 'destacados') {
    sorted.sort((a, b) => premiumRank(a) - premiumRank(b) || byName(a, b));
  } else if (sort === 'calificacion') {
    // A listing with no rating is not "worst rated", it is unrated — it sorts
    // after every rated one instead of being scored as a zero.
    const rank = (l: Listing) => (typeof l.rating === 'number' ? 0 : 1);
    sorted.sort(
      (a, b) => rank(a) - rank(b) || (b.rating ?? 0) - (a.rating ?? 0) || byName(a, b),
    );
  } else if (sort === 'cerca' && near) {
    // Same treatment: a listing nobody has geocoded is unknown-distance, not
    // infinitely far, but it still cannot be ranked, so it goes last by name.
    const distance = (l: Listing) =>
      isValidPoint(l) ? approxDistanceKm(near, { lat: l.lat, lng: l.lng }) : Number.POSITIVE_INFINITY;
    sorted.sort((a, b) => {
      const d = distance(a) - distance(b);
      if (Number.isNaN(d) || d === 0) return byName(a, b);
      return d;
    });
  } else {
    // relevancia: premium first (when requested), then verified, then name.
    sorted.sort((a, b) => {
      if (premiumFirst) {
        const pr = premiumRank(a) - premiumRank(b);
        if (pr) return pr;
      }
      const vr = (a.verified ? 0 : 1) - (b.verified ? 0 : 1);
      if (vr) return vr;
      return byName(a, b);
    });
  }
  return sorted;
}

/** Category × city combos that actually have listings (for SEO pages + sitemap). */
export function combosWithListings(all: Listing[]): CategoryCityCombo[] {
  const counts = new Map<string, number>();
  for (const l of all) {
    const key = `${l.categoria}|${l.ciudad}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => {
    const [categoria, ciudad] = key.split('|');
    return { categoria: categoria!, ciudad: ciudad!, count };
  });
}

/**
 * Category × city × zona (barrio) combos that have listings (SEO barrio
 * pages, ROADMAP Phase D item 6). `zona` is free text an editor typed
 * (BUILD-SPEC-PR4 §1, no controlled vocabulary), so this is grouped on the
 * exact trimmed value — the same "no artificial threshold" policy as
 * `combosWithListings` above: any zona with at least one listing gets a page.
 * A listing with no zona at all is excluded; there is nothing to name the
 * page after.
 */
export function combosWithZonaListings(all: Listing[]): CategoryCityZonaCombo[] {
  const counts = new Map<string, number>();
  for (const l of all) {
    const zona = l.zona?.trim();
    if (!zona) continue;
    const key = `${l.categoria}|${l.ciudad}|${zona}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => {
    const [categoria, ciudad, zona] = key.split('|');
    return { categoria: categoria!, ciudad: ciudad!, zona: zona!, count };
  });
}
