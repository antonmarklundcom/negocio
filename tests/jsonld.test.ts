import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  listingJsonLd,
  siteJsonLd,
} from '@/lib/jsonld';
import { siteOpenGraph } from '@/lib/i18n/metadata';
import { SITE_URL } from '@/lib/config';
import { routing } from '@/lib/i18n/routing';
import type { Listing } from '@/lib/types';

const listing: Listing = {
  id: '1',
  slug: 'cafe-del-parana',
  name: 'Café del Paraná',
  categoria: 'restaurantes',
  categoriaLabel: 'Restaurante',
  ciudad: 'encarnacion',
  ciudadLabel: 'Encarnación',
  logoInitial: 'C',
  verified: false,
};

/**
 * The locale move (W3-3) left every URL in `lib/jsonld.tsx` unprefixed while
 * the canonical beside it self-referenced `/en/…`. Verified on a production
 * build at the time: `/en/lugar/cafe-del-parana` carried
 * `canonical=/en/lugar/…` and a `LocalBusiness` whose `@id` was `/lugar/…`.
 *
 * `@id` is the entity's identity, so the two locale pages were claiming to be
 * the same node while their canonicals disagreed. These tests exist so a third
 * locale — Guaraní is one entry in `routing.locales` away (D1) — cannot
 * reintroduce it.
 */
describe('listingJsonLd', () => {
  it('emits URLs in the locale of the page it is rendered on', () => {
    const en = listingJsonLd(listing, 'en');
    expect(en['@id']).toBe(`${SITE_URL}/en/lugar/cafe-del-parana`);
    expect(en.url).toBe(`${SITE_URL}/en/lugar/cafe-del-parana`);

    const es = listingJsonLd(listing, 'es');
    expect(es['@id']).toBe(`${SITE_URL}/lugar/cafe-del-parana`);
  });

  it('gives each locale its own @id, never a shared one', () => {
    const ids = routing.locales.map((l) => listingJsonLd(listing, l)['@id']);
    expect(new Set(ids).size).toBe(routing.locales.length);
  });
});

describe('breadcrumbJsonLd', () => {
  it('prefixes every crumb, so English labels never point at Spanish URLs', () => {
    const crumbs = breadcrumbJsonLd(
      [{ label: 'Home', href: '/' }, { label: 'Restaurant', href: '/restaurantes' }, { label: 'Café' }],
      'en',
    );
    const items = crumbs.itemListElement as Array<Record<string, unknown>>;
    expect(items[0]?.item).toBe(`${SITE_URL}/en`);
    expect(items[1]?.item).toBe(`${SITE_URL}/en/restaurantes`);
    // The last crumb is the current page: a name with no link, as before.
    expect(items[2]?.item).toBeUndefined();
  });
});

describe('itemListJsonLd', () => {
  it('prefixes every item URL and identifies the page it describes', () => {
    const list = itemListJsonLd([listing], 'en', '/restaurantes/encarnacion');
    expect(list['@id']).toBe(`${SITE_URL}/en/restaurantes/encarnacion#listado`);
    expect(list.numberOfItems).toBe(1);
    const items = list.itemListElement as Array<Record<string, unknown>>;
    expect(items[0]?.url).toBe(`${SITE_URL}/en/lugar/cafe-del-parana`);
    expect(items[0]?.position).toBe(1);
  });

  it('distinguishes the lists on two different pages', () => {
    const a = itemListJsonLd([listing], 'es', '/restaurantes');
    const b = itemListJsonLd([listing], 'es', '/restaurantes/encarnacion');
    expect(a['@id']).not.toBe(b['@id']);
  });
});

describe('siteJsonLd', () => {
  it('sends the search action to the search page of its own locale', () => {
    const action = siteJsonLd('en').potentialAction as Record<string, unknown>;
    expect(action.target).toBe(`${SITE_URL}/en/buscar?q={search_term_string}`);
    expect(siteJsonLd('en').url).toBe(`${SITE_URL}/en`);

    const es = siteJsonLd('es').potentialAction as Record<string, unknown>;
    expect(es.target).toBe(`${SITE_URL}/buscar?q={search_term_string}`);
  });
});

/**
 * Next merges metadata SHALLOWLY: a page returning its own `openGraph` object
 * replaces the layout's outright. Before `siteOpenGraph` existed, the listing
 * page did exactly that and `/lugar/<slug>` shipped with `og:title` and
 * `og:description` and nothing else — no `og:site_name`, no `og:locale`, no
 * `og:type`, no `og:url` — on a site whose links are shared on WhatsApp.
 */
describe('siteOpenGraph', () => {
  it('carries the fields a page-level openGraph would otherwise drop', () => {
    // `Metadata['openGraph']` is a discriminated union; the test asserts on the
    // resolved object, so it reads it as a plain record rather than narrowing.
    const og = siteOpenGraph('/lugar/cafe-del-parana', 'en') as Record<string, unknown>;
    expect(og.type).toBe('website');
    expect(og.siteName).toBeTruthy();
    expect(og.locale).toBe('en_US');
    // Self-referencing and locale-correct: the shared card names the page it
    // came from, not the home page.
    expect(og.url).toBe(`${SITE_URL}/en/lugar/cafe-del-parana`);
  });

  it('leaves images alone — the caller decides photo vs generated card', () => {
    expect(siteOpenGraph('/', 'es')).not.toHaveProperty('images');
  });
});
