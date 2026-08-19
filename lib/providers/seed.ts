import type { ListingsProvider } from './types';
import { SEED_LISTINGS } from './seed-data';
import { applyQuery, combosWithListings, combosWithZonaListings } from './query';
import { CATEGORIES } from '../categories';
import { CITIES } from '../cities';
import type { Listing } from '../types';

/**
 * Published only (ROADMAP W2-1 / D2). Every seeded listing is live by
 * construction, so `status` is absent from the dataset and this filter passes
 * everything today. It exists so the two providers cannot drift: the whole
 * value of the seam in `lib/listings-repo.ts` is that a page renders the same
 * way against seed data and against MySQL, and a filter present in one and
 * absent in the other is exactly how that stops being true.
 */
function published(listings: Listing[]): Listing[] {
  return listings.filter((l) => (l.status ?? 'published') === 'published');
}

const PUBLIC_SEED = published(SEED_LISTINGS);

/**
 * Seed provider — the permanent fallback (§5.4). Renders entirely from the
 * built-in dataset with no network access. Categories/cities are filtered to
 * those that actually have at least one seeded listing so we never advertise an
 * empty rubro or city.
 */
export const seedProvider: ListingsProvider = {
  name: 'seed',

  async getListings(params) {
    return applyQuery(PUBLIC_SEED, params);
  },

  async getListingBySlug(slug) {
    return PUBLIC_SEED.find((l) => l.slug === slug) ?? null;
  },

  async getCategories() {
    const present = new Set(PUBLIC_SEED.map((l) => l.categoria));
    return CATEGORIES.filter((c) => present.has(c.slug));
  },

  async getCities() {
    const present = new Set(PUBLIC_SEED.map((l) => l.ciudad));
    return CITIES.filter((c) => present.has(c.slug));
  },

  async getCategoryCityCombosWithListings() {
    return combosWithListings(PUBLIC_SEED);
  },

  async getCategoryCityZonaCombosWithListings() {
    return combosWithZonaListings(PUBLIC_SEED);
  },
};
