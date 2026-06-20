import type { ListingQuery } from './types';
import { DEFAULT_PAGE_SIZE } from './config';

export type RawParams = { [key: string]: string | string[] | undefined };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Map the page's URL search params to a ListingQuery. The public query keys are
 * Spanish (?rubro=&zona=&sort=&abierto=&q=) per §6.2; we translate `rubro` →
 * `categoria` here so URLs stay localized but the repo speaks one vocabulary.
 */
export function toListingQuery(raw: RawParams, overrides: Partial<ListingQuery> = {}): ListingQuery {
  const sortRaw = one(raw.sort);
  const sort: ListingQuery['sort'] =
    sortRaw === 'destacados' || sortRaw === 'nombre' ? sortRaw : 'relevancia';
  const pageNum = parseInt(one(raw.page) ?? '1', 10);

  return {
    categoria: one(raw.rubro),
    ciudad: one(raw.ciudad),
    zona: one(raw.zona),
    q: one(raw.q),
    abierto: one(raw.abierto) === '1',
    sort,
    premiumFirst: true,
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    pageSize: DEFAULT_PAGE_SIZE,
    ...overrides,
  };
}
