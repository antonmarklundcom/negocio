import type { Metadata } from 'next';
import { SITE_URL } from '../config';
import { routing, type Locale } from './routing';

/**
 * `canonical` + `hreflang` for a page, in one place (ROADMAP D1 / W3-3).
 *
 * Every localized page needs the same three things and they are easy to get
 * subtly wrong one route at a time, so no route builds them by hand:
 *
 * 1. **A self-referencing canonical.** `/en/buscar` must point at itself, not
 *    at `/buscar`. A canonical from the English page to the Spanish one tells
 *    Google the English page should not be indexed — which is the opposite of
 *    the reason it exists.
 * 2. **`alternates.languages` naming every locale, on every locale's page.**
 *    hreflang is only honoured when the annotations are reciprocal: the Spanish
 *    page must point at the English one *and back at itself*.
 * 3. **`x-default`.** Pointing at Spanish, because the default locale carries
 *    no prefix and this is a Paraguayan directory: someone with no matching
 *    language preference should land on the site as it actually is.
 */

/** Absolute URL for a site-relative path in a given locale. */
export function localeUrl(path: string, locale: Locale): string {
  const clean = path === '/' ? '' : path.replace(/\/$/, '');
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${SITE_URL}${prefix}${clean}` || `${SITE_URL}/`;
}

/** Site-relative href for a path in a given locale — for `<Link>`, not metadata. */
export function localePath(path: string, locale: Locale): string {
  const clean = path === '/' ? '' : path.replace(/\/$/, '');
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${prefix}${clean}` || '/';
}

/**
 * The hreflang map. Keys are the tags a crawler matches on, so Spanish is
 * `es-PY` rather than bare `es` — the copy is voseo and the prices are in ₲.
 */
const HREFLANG: Record<Locale, string> = { es: 'es-PY', en: 'en' };

export function alternatesFor(path: string, locale: Locale): Metadata['alternates'] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[HREFLANG[l]] = localeUrl(path, l);
  languages['x-default'] = localeUrl(path, routing.defaultLocale);

  return { canonical: localeUrl(path, locale), languages };
}
