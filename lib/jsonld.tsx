import type { Listing } from './types';
import { SITE_URL, SITE_NAME, listingPath, REVIEWS_ENABLED } from './config';
import { toSchemaOpeningHours } from './hours';
import { mediaUrl } from './media/url';
import type { Crumb } from '@/components/Breadcrumb';

/** schema.org LocalBusiness for a detail page (§9). Only emits real data. */
export function listingJsonLd(l: Listing): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}${listingPath(l.slug)}`,
    name: l.name,
    url: `${SITE_URL}${listingPath(l.slug)}`,
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

/** schema.org ItemList for category / landing pages (§9). */
export function itemListJsonLd(listings: Listing[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: listings.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}${listingPath(l.slug)}`,
      name: l.name,
    })),
  };
}

export function breadcrumbJsonLd(items: Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${SITE_URL}${c.href}` } : {}),
    })),
  };
}

export function siteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/buscar?q={search_term_string}`,
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
