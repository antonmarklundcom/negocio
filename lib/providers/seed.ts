import type { ListingsProvider } from './types';
import { SEED_LISTINGS } from './seed-data';
import { applyQuery, combosWithListings, combosWithZonaListings } from './query';
import { CATEGORIES } from '../categories';
import { CITIES } from '../cities';

/**
 * Seed provider — the permanent fallback (§5.4). Renders entirely from the
 * built-in dataset with no network access. Categories/cities are filtered to
 * those that actually have at least one seeded listing so we never advertise an
 * empty rubro or city.
 */
export const seedProvider: ListingsProvider = {
  name: 'seed',

  async getListings(params) {
    return applyQuery(SEED_LISTINGS, params);
  },

  async getListingBySlug(slug) {
    return SEED_LISTINGS.find((l) => l.slug === slug) ?? null;
  },

  async getCategories() {
    const present = new Set(SEED_LISTINGS.map((l) => l.categoria));
    return CATEGORIES.filter((c) => present.has(c.slug));
  },

  async getCities() {
    const present = new Set(SEED_LISTINGS.map((l) => l.ciudad));
    return CITIES.filter((c) => present.has(c.slug));
  },

  async getCategoryCityCombosWithListings() {
    return combosWithListings(SEED_LISTINGS);
  },

  async getCategoryCityZonaCombosWithListings() {
    return combosWithZonaListings(SEED_LISTINGS);
  },
};
