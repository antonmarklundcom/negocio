import type {
  Category,
  City,
  CategoryCityCombo,
  CategoryCityZonaCombo,
  Listing,
  ListingQuery,
  ListingResult,
} from '../types';

/**
 * The contract every data provider implements. The repository (lib/listings-repo)
 * picks one provider; pages only ever talk to the repository. Swapping the
 * backend = adding a provider + one line in the repo (§5.1).
 */
export interface ListingsProvider {
  readonly name: string;
  getListings(params: ListingQuery): Promise<ListingResult>;
  getListingBySlug(slug: string): Promise<Listing | null>;
  getCategories(): Promise<Category[]>;
  getCities(): Promise<City[]>;
  getCategoryCityCombosWithListings(): Promise<CategoryCityCombo[]>;
  /** SEO barrio pages (ROADMAP Phase D item 6). */
  getCategoryCityZonaCombosWithListings(): Promise<CategoryCityZonaCombo[]>;
}
