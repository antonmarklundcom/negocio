import type { Listing } from './types';
import { SITE_URL, SITE_NAME, listingPath, REVIEWS_ENABLED } from './config';
import { toSchemaOpeningHours } from './hours';
import { mediaUrl } from './media/url';
import { localeUrl } from './i18n/alternates';
import { routing, type Locale } from './i18n/routing';
import type { Crumb } from '@/components/Breadcrumb';

/**
 * Every URL in this file is built with `localeUrl` (ROADMAP W3-3), never with
 * bare `SITE_URL` + path.
 *
 * The locale move made these builders wrong in a way nothing catches at build
 * time: `/en/lugar/x` carries a self-referencing canonical pointing at itself,
 * while its `LocalBusiness` used to announce `@id`/`url` of the *Spanish*
 * `/lugar/x`. That is not a cosmetic mismatch — `@id` is the entity's identity,
 * so the two locale pages were claiming to be the same node, and the structured
 * data disagreed with the canonical on the very same page. Breadcrumbs had the
 * same shape: English labels ("Home", "Restaurant") pointing at Spanish URLs.
 *
 * Locale is therefore a required argument on everything that emits a URL. It
 * defaults to nothing: a caller that forgets it fails to compile rather than
 * silently emitting Spanish URLs on an English page.
 */

/** schema.org LocalBusiness for a detail page (§9). Only emits real data. */
export function listingJsonLd(l: Listing, locale: Locale): Record<string, unknown> {
  const url = localeUrl(listingPath(l.slug), locale);
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': url,
    name: l.name,
    url,
  };
  if (l.description) data.description = l.description;
  if (l.coverImage) {
    const resolved = mediaUrl(l.coverImage);
    // A relative key there would be invalid structured data — always emit an absolute URL.
    data.image = /^https?:\/\//.test(resolved) ? resolved : `${SITE_URL}${resolved}`;
  }
  if (l.phone) data.telephone = l.phone;
  if (l.address || l.ciudadLabel) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: l.address,
      addressLocality: l.ciudadLabel,
      addressCountry: 'PY',
    };
  }
  if (l.lat != null && l.lng != null) {
    data.geo = { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng };
  }
  const hours = toSchemaOpeningHours(l.hours);
  if (hours.length) data.openingHours = hours;

  // Honesty gate: ratings only when reviews are enabled AND real data exists (§6.6).
  if (REVIEWS_ENABLED && l.rating && l.reviewsCount) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: l.rating,
      reviewCount: l.reviewsCount,
    };
  }
  return data;
}

/**
 * schema.org ItemList for the listing pages (§9).
 *
 * `url` only, no nested `LocalBusiness` per item: the full entity lives on the
 * detail page, and repeating a partial copy of it on every category page would
 * hand Google two descriptions of the same node — the sparser one being the
 * one it sees far more often.
 *
 * The list describes the page it is on, so it takes the page's own URL as
 * `@id`. Without that, the ItemList on `/restaurantes/asuncion` and the one on
 * `/restaurantes` are indistinguishable nodes.
 */
export function itemListJsonLd(
  listings: Listing[],
  locale: Locale,
  path: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${localeUrl(path, locale)}#listado`,
    numberOfItems: listings.length,
    itemListElement: listings.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: localeUrl(listingPath(l.slug), locale),
      name: l.name,
    })),
  };
}

export function breadcrumbJsonLd(items: Crumb[], locale: Locale): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: localeUrl(c.href, locale) } : {}),
    })),
  };
}

export function siteJsonLd(locale: Locale = routing.defaultLocale): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: localeUrl('/', locale),
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      // The search page is locale-prefixed like every other page: an English
      // visitor arriving through this action must land on `/en/buscar`.
      target: `${localeUrl('/buscar', locale)}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Render a JSON-LD <script> tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
