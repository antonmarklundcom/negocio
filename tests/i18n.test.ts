import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HTML_LANG, isLocale, LOCALE_LABEL, OG_LOCALE, routing, toLocale } from '@/lib/i18n/routing';
import { alternatesFor, localePath, localeUrl } from '@/lib/i18n/alternates';
import { defaultMetadata } from '@/lib/i18n/metadata';
import { categoryLabelFor, categoryLabelPluralFor, untranslatedCategories, CATEGORIES } from '@/lib/categories';
import { cityLabelFor, CITIES } from '@/lib/cities';
import { SITE_URL } from '@/lib/config';

describe('routing', () => {
  it('keeps Spanish as the unprefixed default (D1)', () => {
    // Every URL indexed or shared before W3-3 has to keep working. If this
    // flips, the whole site moves to /es and every existing link 404s or
    // redirects — which is the one thing D1 ruled out.
    expect(routing.defaultLocale).toBe('es');
    expect(routing.localePrefix).toBe('as-needed');
    expect(routing.locales).toEqual(['es', 'en']);
  });

  it('does not redirect on Accept-Language', () => {
    // Paraguayan phones commonly report en-US. Auto-detection would bounce
    // local visitors into an English translation of a Spanish directory.
    expect(routing.localeDetection).toBe(false);
  });

  it('has a full language tag, an og:locale and a label for every locale', () => {
    for (const l of routing.locales) {
      expect(HTML_LANG[l]).toBeTruthy();
      expect(OG_LOCALE[l]).toBeTruthy();
      expect(LOCALE_LABEL[l]).toBeTruthy();
    }
    // es-PY, not bare es: the copy is voseo and the prices are in guaraníes.
    expect(HTML_LANG.es).toBe('es-PY');
  });

  it('narrows an unknown segment to the default instead of throwing', () => {
    expect(toLocale('en')).toBe('en');
    expect(toLocale('es')).toBe('es');
    for (const bad of ['xx', '', 'EN', 'restaurantes', '../en']) expect(toLocale(bad)).toBe('es');
    expect(isLocale('gn')).toBe(false);
  });
});

describe('localePath / localeUrl', () => {
  it('never prefixes the default locale', () => {
    expect(localePath('/', 'es')).toBe('/');
    expect(localePath('/buscar', 'es')).toBe('/buscar');
    expect(localeUrl('/buscar', 'es')).toBe(`${SITE_URL}/buscar`);
  });

  it('always prefixes every other locale', () => {
    expect(localePath('/', 'en')).toBe('/en');
    expect(localePath('/buscar', 'en')).toBe('/en/buscar');
    expect(localeUrl('/lugar/x', 'en')).toBe(`${SITE_URL}/en/lugar/x`);
  });

  it('keeps the Spanish slug in the English URL (D1)', () => {
    // /en/restaurantes/asuncion, never /en/restaurants/asuncion.
    expect(localePath('/restaurantes/asuncion', 'en')).toBe('/en/restaurantes/asuncion');
  });

  it('never emits a doubled or trailing slash', () => {
    for (const l of routing.locales) {
      for (const path of ['/', '/buscar', '/buscar/']) {
        const url = localeUrl(path, l);
        expect(url).not.toMatch(/([^:]\/\/)/);
        expect(url.endsWith('/')).toBe(url === `${SITE_URL}/`);
      }
    }
  });
});

describe('alternatesFor', () => {
  it('gives each locale a canonical pointing at ITSELF', () => {
    // A canonical from /en/buscar to /buscar tells Google not to index the
    // English page, which is the opposite of the reason it exists.
    expect(alternatesFor('/buscar', 'en')?.canonical).toBe(`${SITE_URL}/en/buscar`);
    expect(alternatesFor('/buscar', 'es')?.canonical).toBe(`${SITE_URL}/buscar`);
  });

  it('is reciprocal — every locale lists every locale, itself included', () => {
    // hreflang is only honoured when the annotations point both ways.
    for (const l of routing.locales) {
      const languages = alternatesFor('/precios', l)?.languages ?? {};
      expect(languages['es-PY']).toBe(`${SITE_URL}/precios`);
      expect(languages['en']).toBe(`${SITE_URL}/en/precios`);
    }
  });

  it('points x-default at Spanish', () => {
    const languages = alternatesFor('/', 'en')?.languages ?? {};
    expect(languages['x-default']).toBe(localeUrl('/', 'es'));
  });
});

describe('defaultMetadata', () => {
  it('is identical for the panel and the public site, which is the point', () => {
    // `/admin` 404s rather than 403s. If the panel's root layout carried its
    // own title, `curl /admin` would confirm the panel exists. Both roots call
    // this, so they cannot drift.
    const panel = defaultMetadata();
    const site = defaultMetadata('es');
    expect(panel).toEqual(site);
    expect(JSON.stringify(panel)).not.toMatch(/panel/i);
  });

  it('translates the title and description, and swaps og:locale', () => {
    const en = defaultMetadata('en');
    expect(JSON.stringify(en.title)).toMatch(/Find businesses/);
    expect(en.description).toMatch(/business directory/);
    expect(en.openGraph?.locale).toBe('en_US');
  });
});

describe('taxonomy labels (D1: labels translate, slugs do not)', () => {
  it('returns Spanish labels unchanged for the default locale', () => {
    expect(categoryLabelFor('restaurantes', 'es')).toBe('Restaurante');
    expect(categoryLabelPluralFor('restaurantes', 'es')).toBe('Restaurantes y cafés');
  });

  it('has an explicit English entry for EVERY category', () => {
    // Asserted against the lookup, not against the rendered label: the fallback
    // returns the SPANISH label for a missing entry, so a test that only
    // checked "not the raw slug" would pass while the English site went
    // half-Spanish. This is the assertion that actually fails.
    expect(untranslatedCategories('en')).toEqual([]);
    expect(untranslatedCategories('es')).toEqual([]);
  });

  it('actually renders the English label, not the Spanish one', () => {
    expect(categoryLabelFor('restaurantes', 'en')).toBe('Restaurant');
    expect(categoryLabelPluralFor('veterinarias', 'en')).toBe('Veterinary clinics');
    for (const c of CATEGORIES) {
      expect(categoryLabelFor(c.slug, 'en')).not.toBe(c.slug);
      expect(categoryLabelPluralFor(c.slug, 'en')).not.toBe(c.slug);
    }
  });

  it('falls back rather than rendering a slug for an unknown category', () => {
    expect(categoryLabelFor('no-existe', 'en')).toBe('no-existe');
  });

  it('leaves city names alone — Asunción is Asunción in English', () => {
    for (const c of CITIES) {
      expect(cityLabelFor(c.slug, 'en')).toBe(c.label);
    }
  });
});

describe('message catalogues', () => {
  const load = (locale: string) =>
    JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));

  const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    );

  it('exists for every configured locale', () => {
    for (const l of routing.locales) expect(load(l)).toBeTypeOf('object');
  });

  it('has exactly the same keys in every locale', () => {
    // A key present in one catalogue and missing from another renders the key
    // itself to a visitor. Adding Guaraní later makes this the first thing to
    // fail, which is the intent.
    const base = flatten(load(routing.defaultLocale)).sort();
    for (const l of routing.locales) {
      expect(flatten(load(l)).sort(), `locale ${l}`).toEqual(base);
    }
  });

  it('has no empty strings', () => {
    for (const l of routing.locales) {
      const values = JSON.stringify(load(l));
      expect(values).not.toMatch(/":\s*""/);
    }
  });
});
