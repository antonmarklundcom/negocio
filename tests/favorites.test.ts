import { describe, expect, it } from 'vitest';
import {
  decodeFavorites,
  encodeFavorites,
  FAVORITES_LIMIT,
  isValidSlug,
  parseFavorites,
  sameList,
  serialiseFavorites,
  toggleFavorite,
} from '@/lib/favorites';
import { applyQuery } from '@/lib/providers/query';
import type { Listing } from '@/lib/types';

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: overrides.id ?? 'x',
    slug: overrides.slug ?? 'x',
    name: overrides.name ?? 'X',
    categoria: 'restaurantes',
    categoriaLabel: 'Restaurante',
    ciudad: 'asuncion',
    ciudadLabel: 'Asunción',
    logoInitial: 'X',
    verified: false,
    ...overrides,
  };
}

describe('isValidSlug', () => {
  it('accepts the shape this site actually mints', () => {
    expect(isValidSlug('cafe-del-parana')).toBe(true);
    expect(isValidSlug('asado')).toBe(true);
    expect(isValidSlug('taller-24h')).toBe(true);
  });

  it('rejects anything that is not one', () => {
    // These values arrive from localStorage — writable by any script on the
    // origin — and go on to reach a URL and a database query, so the gate is
    // deliberately narrow rather than merely "not obviously dangerous".
    for (const bad of [
      '',
      'Cafe-Del-Parana', // uppercase
      'cafe del parana', // spaces
      '-leading',
      'trailing-',
      'double--hyphen',
      '../../etc/passwd',
      'slug?ids=x',
      'slug,other',
      '<script>',
      "' OR 1=1 --",
      'a'.repeat(121),
      42,
      null,
      undefined,
      { slug: 'x' },
    ]) {
      expect(isValidSlug(bad)).toBe(false);
    }
  });
});

describe('parseFavorites', () => {
  it('reads a normal list back in order', () => {
    expect(parseFavorites('["a","b-c"]')).toEqual(['a', 'b-c']);
  });

  it('degrades to an empty list rather than throwing on anything malformed', () => {
    for (const bad of [null, '', 'not json', '{"a":1}', '"a string"', '42', 'null']) {
      expect(parseFavorites(bad)).toEqual([]);
    }
  });

  it('keeps the valid entries and silently drops the rest', () => {
    expect(parseFavorites('["ok-one", 42, "Bad Slug", null, "ok-two"]')).toEqual(['ok-one', 'ok-two']);
  });

  it('de-duplicates, keeping the first occurrence', () => {
    expect(parseFavorites('["a","b","a"]')).toEqual(['a', 'b']);
  });

  it('never returns more than the cap, however large the stored array', () => {
    const many = JSON.stringify(Array.from({ length: 500 }, (_, i) => `slug-${i}`));
    expect(parseFavorites(many)).toHaveLength(FAVORITES_LIMIT);
  });

  it('round-trips through serialise', () => {
    const slugs = ['cafe-del-parana', 'asado-paraguay'];
    expect(parseFavorites(serialiseFavorites(slugs))).toEqual(slugs);
  });
});

describe('toggleFavorite', () => {
  it('adds to the front, so the newest save is first', () => {
    expect(toggleFavorite(['b'], 'a')).toEqual(['a', 'b']);
  });

  it('removes an existing entry without disturbing the others', () => {
    expect(toggleFavorite(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('drops the oldest at the cap instead of refusing the new one', () => {
    const full = Array.from({ length: FAVORITES_LIMIT }, (_, i) => `slug-${i}`);
    const next = toggleFavorite(full, 'brand-new');
    expect(next).toHaveLength(FAVORITES_LIMIT);
    expect(next[0]).toBe('brand-new');
    expect(next).not.toContain(`slug-${FAVORITES_LIMIT - 1}`);
  });

  it('ignores a slug it would refuse to store', () => {
    expect(toggleFavorite(['a'], 'Not A Slug')).toEqual(['a']);
  });
});

describe('encode/decode for the URL', () => {
  it('round-trips', () => {
    const slugs = ['cafe-del-parana', 'asado-paraguay'];
    expect(decodeFavorites(encodeFavorites(slugs))).toEqual(slugs);
  });

  it('drops anything invalid rather than passing it to the query', () => {
    expect(decodeFavorites('ok-one,<script>,ok-two,,  ,Bad')).toEqual(['ok-one', 'ok-two']);
  });

  it('caps a hand-written URL, so ?ids= cannot be used to scan the table', () => {
    const many = Array.from({ length: 500 }, (_, i) => `slug-${i}`).join(',');
    expect(decodeFavorites(many)).toHaveLength(FAVORITES_LIMIT);
  });

  it('treats a missing or empty parameter as no favorites', () => {
    expect(decodeFavorites(undefined)).toEqual([]);
    expect(decodeFavorites('')).toEqual([]);
    expect(decodeFavorites(',,,')).toEqual([]);
  });
});

describe('sameList', () => {
  it('is order-sensitive, so a reorder still re-renders', () => {
    expect(sameList(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameList(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameList(['a'], ['a', 'b'])).toBe(false);
    expect(sameList([], [])).toBe(true);
  });
});

describe('applyQuery — slugs filter', () => {
  const all = [
    listing({ id: '1', slug: 'uno', name: 'Uno' }),
    listing({ id: '2', slug: 'dos', name: 'Dos' }),
    listing({ id: '3', slug: 'tres', name: 'Tres' }),
  ];

  it('returns exactly the requested slugs', () => {
    const { items, total } = applyQuery(all, { slugs: ['uno', 'tres'] });
    expect(items.map((l) => l.slug).sort()).toEqual(['tres', 'uno']);
    expect(total).toBe(2);
  });

  it('an empty list means no listings, NOT the whole directory', () => {
    // The failure mode this guards is loud in the worst way: an empty favorites
    // page that renders every business on the site.
    expect(applyQuery(all, { slugs: [] }).items).toEqual([]);
    expect(applyQuery(all, { slugs: [] }).total).toBe(0);
  });

  it('silently ignores a slug with no listing behind it', () => {
    // A business archived since it was saved. The page reports the count; the
    // query does not fail.
    const { items } = applyQuery(all, { slugs: ['uno', 'ya-no-existe'] });
    expect(items.map((l) => l.slug)).toEqual(['uno']);
  });
});
