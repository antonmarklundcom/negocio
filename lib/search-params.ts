import type { ListingQuery } from './types';
import { parsePoint } from './geo';
import { REVIEWS_ENABLED } from './config';
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
  const near = parsePoint(one(raw.lat), one(raw.lng));
  const pageNum = parseInt(one(raw.page) ?? '1', 10);

  return {
    categoria: one(raw.rubro),
    ciudad: one(raw.ciudad),
    zona: one(raw.zona),
    q: one(raw.q),
    abierto: one(raw.abierto) === '1',
    sort: parseSort(one(raw.sort), near),
    near,
    premiumFirst: true,
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    pageSize: DEFAULT_PAGE_SIZE,
    ...overrides,
  };
}

/**
 * An unknown `?sort=` is `relevancia`, never an error — the value is in a URL
 * anyone can type. Two of them are conditional rather than merely validated:
 *
 * - `calificacion` only exists while `REVIEWS_ENABLED` is on. The whole ratings
 *   UI is behind that honesty gate (§6.6); a sort that silently orders by a
 *   number the site refuses to display would be the gate leaking.
 * - `cerca` only exists with a usable point. Someone who declined the location
 *   prompt, or pasted the URL without the coordinates, gets `relevancia`.
 */
export function parseSort(sortRaw: string | undefined, near?: { lat: number; lng: number }): ListingQuery['sort'] {
  if (sortRaw === 'destacados' || sortRaw === 'nombre') return sortRaw;
  if (sortRaw === 'calificacion' && REVIEWS_ENABLED) return 'calificacion';
  if (sortRaw === 'cerca' && near) return 'cerca';
  return 'relevancia';
}

/**
 * Query keys that must survive a pager link or a search submit.
 *
 * One list, because there were four hand-written copies of it — one per route
 * that renders `<Pagination>` — and a filter missing from any of them silently
 * reset itself on page 2. `lat`/`lng` (ROADMAP W3-1) is the case that would
 * have gone wrong quietly: the pager would have kept `sort=cerca` and dropped
 * the position, and `parseSort` would have answered `relevancia`, so page 2 of
 * "Cerca de mí" would be an ordinary alphabetical page that looked fine.
 *
 * Keys fixed by the route (`rubro` on /[categoria], `ciudad` on
 * /[categoria]/[ciudad]) are harmless to list: they live in the path, never in
 * the query string, so there is nothing to copy.
 */
export const CARRIED_PARAMS = ['rubro', 'ciudad', 'zona', 'q', 'abierto', 'sort', 'lat', 'lng'] as const;

/** The subset of `CARRIED_PARAMS` actually present in this request's URL. */
export function carriedParams(raw: RawParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of CARRIED_PARAMS) {
    const v = one(raw[k]);
    if (v) out[k] = v;
  }
  return out;
}
