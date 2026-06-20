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
import { jetengineProvider, jetengineConfigured } from './providers/jetengine';

/**
 * THE single data-access surface (§5.1). Every page and API route imports from
 * here — nothing else calls WordPress or fetch directly.
 *
 * Provider selection:
 *   NEXT_PUBLIC_BACKEND=jetengine + creds present → JetEngine, with the seed as
 *   an automatic fallback on any error. Otherwise → seed.
 *
 * To swap to Supabase later: add lib/providers/supabase.ts and change the one
 * `primary` line below. Nothing else in the app changes.
 */
function selectPrimary(): ListingsProvider {
  if (process.env.NEXT_PUBLIC_BACKEND === 'jetengine' && jetengineConfigured()) {
    return jetengineProvider;
    // return supabaseProvider; // ← future: one-line swap
  }
  return seedProvider;
}

const primary = selectPrimary();
const fallback = seedProvider;
const usingFallback = primary === fallback;

/** Run against the primary provider; on any error fall back to the seed. */
async function withFallback<T>(
  run: (p: ListingsProvider) => Promise<T>,
  label: string,
): Promise<T> {
  try {
    return await run(primary);
  } catch (err) {
    if (!usingFallback) {
      console.error(`[listings-repo] ${primary.name} failed for ${label}; using seed fallback.`, err);
      return run(fallback);
    }
    throw err;
  }
}

export function getListings(params: ListingQuery): Promise<ListingResult> {
  return withFallback((p) => p.getListings(params), 'getListings');
}

export function getListingBySlug(slug: string): Promise<Listing | null> {
  return withFallback((p) => p.getListingBySlug(slug), `getListingBySlug(${slug})`);
}

export function getCategories(): Promise<Category[]> {
  return withFallback((p) => p.getCategories(), 'getCategories');
}

export function getCities(): Promise<City[]> {
  return withFallback((p) => p.getCities(), 'getCities');
}

export function getCategoryCityCombosWithListings(): Promise<CategoryCityCombo[]> {
  return withFallback((p) => p.getCategoryCityCombosWithListings(), 'getCategoryCityCombosWithListings');
}
