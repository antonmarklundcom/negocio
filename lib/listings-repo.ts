import 'server-only';
import type {
  Category,
  City,
  CategoryCityCombo,
  Listing,
  ListingQuery,
  ListingResult,
} from './types';
import type { ListingsProvider } from './providers/types';
import { seedProvider } from './providers/seed';
import { dbProvider, dbConfigured } from './providers/db';

/**
 * THE single data-access surface (§5.1). Every page and API route imports from
 * here — nothing else touches a database or fetches an external CMS directly.
 *
 * Provider selection:
 *   DATABASE_URL set → the MySQL provider. Otherwise → seed (local dev, and the
 *   importer's own source of truth).
 *
 * There is no fallback: a DB error surfaces to the caller instead of silently
 * serving stale seed data. That is the point of the cutover — a page that
 * renders wrong is loud; a page that quietly renders stale data is not.
 */
export function selectPrimary(): ListingsProvider {
  if (dbConfigured()) {
    return dbProvider;
  }
  return seedProvider;
}

const primary = selectPrimary();

export function getListings(params: ListingQuery): Promise<ListingResult> {
  return primary.getListings(params);
}

export function getListingBySlug(slug: string): Promise<Listing | null> {
  return primary.getListingBySlug(slug);
}

export function getCategories(): Promise<Category[]> {
  return primary.getCategories();
}

export function getCities(): Promise<City[]> {
  return primary.getCities();
}

export function getCategoryCityCombosWithListings(): Promise<CategoryCityCombo[]> {
  return primary.getCategoryCityCombosWithListings();
}
