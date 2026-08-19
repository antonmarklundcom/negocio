/**
 * Site-wide constants and feature flags.
 * Anything that might change as a one-line edit lives here.
 */

/** Business-detail URL namespace. Change here only (§4 slug decision). */
export const LISTING_PREFIX = 'lugar';

/** When false, a free listing's phone renders as plain text (no tel: link). */
export const FREE_PHONE_TAPTOCALL = false;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://negocio.com.py'
).replace(/\/$/, '');

export const SITE_NAME = 'negocio.com.py';

/** Platform WhatsApp (header / generic contact), E.164 digits only. */
export const PLATFORM_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '595981000000';

/** Keyless map style. OpenFreeMap (vector) or a CARTO Positron raster fallback. */
export const MAP_TILES =
  process.env.NEXT_PUBLIC_MAP_TILES || 'https://tiles.openfreemap.org/styles/positron';

/** Reviews/ratings UI is hidden until a first-party review system exists (§6.6). */
export const REVIEWS_ENABLED = process.env.NEXT_PUBLIC_REVIEWS_ENABLED === 'true';

/** Launch promo banner — OFF unless explicitly enabled. */
export const PROMO_BANNER_ON = process.env.NEXT_PUBLIC_PROMO_BANNER === 'on';

/** Cookieless analytics (Plausible) — off until a domain is set. See components/Analytics.tsx. */
export const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || '';

export const TIMEZONE = 'America/Asuncion';

export const DEFAULT_PAGE_SIZE = 12;

/**
 * "Destacado en portada" (ROADMAP Phase D item 3) — how many paid home-page
 * featured slots exist at once. Shared between the public home page (how
 * many it fetches) and `lib/db/listings-admin.ts` (the cap it enforces when
 * selling a new slot), so the two can never drift apart.
 */
export const MAX_FEATURED_SLOTS = 6;

/**
 * Reserved top-level path segments. `/[categoria]` must never resolve to one of
 * these, so unknown category paths 404 cleanly (§4 route-collision rule).
 * Category slugs themselves are validated separately against the known set.
 */
export const RESERVED_SLUGS = new Set([
  LISTING_PREFIX,
  'buscar',
  'rubros',
  'precios',
  'sumar-negocio',
  'contacto',
  'nosotros',
  'api',
  'sitemap.xml',
  'robots.txt',
  '_next',
  'favicon.ico',
  'design',
  'legacy',
]);

export function listingPath(slug: string): string {
  return `/${LISTING_PREFIX}/${slug}`;
}
