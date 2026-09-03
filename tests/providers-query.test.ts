import { describe, expect, it } from 'vitest';
import { applyQuery, combosWithZonaListings } from '@/lib/providers/query';
import { isFeatured, isPremium } from '@/lib/listing';
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

const FUTURE = Math.floor(Date.now() / 1000) + 86400;
const PAST = Math.floor(Date.now() / 1000) - 86400;

describe('isFeatured', () => {
  it('is true only while featuredUntil is in the future', () => {
    expect(isFeatured(listing({ featuredUntil: FUTURE }))).toBe(true);
    expect(isFeatured(listing({ featuredUntil: PAST }))).toBe(false);
    expect(isFeatured(listing({}))).toBe(false);
  });
});

describe('applyQuery — destacado filter ("destacado en portada")', () => {
  const all: Listing[] = [
    listing({ id: 'a', name: 'A negocio', featuredUntil: FUTURE }),
    listing({ id: 'b', name: 'B negocio', featuredUntil: PAST }),
    listing({ id: 'c', name: 'C negocio', premiumUntil: FUTURE }), // premium, but not featured
    listing({ id: 'd', name: 'D negocio' }),
  ];

  it('returns only currently-featured listings, independent of premium', () => {
    const result = applyQuery(all, { destacado: true });
    expect(result.items.map((l) => l.id)).toEqual(['a']);
  });

  it('an expired or unset featuredUntil is excluded, even if the listing is premium', () => {
    const result = applyQuery(all, { destacado: true });
    expect(result.items.map((l) => l.id)).not.toContain('c');
    expect(result.items.map((l) => l.id)).not.toContain('b');
    expect(result.items.map((l) => l.id)).not.toContain('d');
  });

  it('without the destacado filter, everything is still returned', () => {
    const result = applyQuery(all, {});
    expect(result.items).toHaveLength(4);
  });
});

describe('applyQuery — accent-insensitive `q` search (ROADMAP F3)', () => {
  const all: Listing[] = [
    listing({ id: 'a', name: 'Farmácia San José', zona: 'Villa Morra' }),
    listing({ id: 'b', name: 'La Farmacia del Centro' }),
    listing({ id: 'c', name: 'Kiosco 24hs' }),
  ];

  it('an unaccented term finds a name typed with the accent', () => {
    const result = applyQuery(all, { q: 'farmacia' });
    expect(result.items.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });

  it('an accented term finds a name typed without the accent too', () => {
    const result = applyQuery(all, { q: 'Farmácia' });
    expect(result.items.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });

  it('still matches the city label, folded the same way ("Asunción" / "asuncion")', () => {
    const result = applyQuery(all, { q: 'asuncion' });
    expect(result.items.map((l) => l.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('isPremium (regression guard — unaffected by the featured-slot addition)', () => {
  it('is still independent of featuredUntil', () => {
    expect(isPremium(listing({ premiumUntil: FUTURE, featuredUntil: PAST }))).toBe(true);
    expect(isPremium(listing({ premiumUntil: PAST, featuredUntil: FUTURE }))).toBe(false);
  });
});

describe('combosWithZonaListings (SEO barrio pages)', () => {
  it('groups by rubro × ciudad × zona and counts', () => {
    const all: Listing[] = [
      listing({ id: 'a', zona: 'Villa Morra' }),
      listing({ id: 'b', zona: 'Villa Morra' }),
      listing({ id: 'c', zona: 'Recoleta' }),
      listing({ id: 'd', ciudad: 'luque', ciudadLabel: 'Luque', zona: 'Villa Morra' }),
    ];
    const combos = combosWithZonaListings(all);
    expect(combos).toContainEqual({ categoria: 'restaurantes', ciudad: 'asuncion', zona: 'Villa Morra', count: 2 });
    expect(combos).toContainEqual({ categoria: 'restaurantes', ciudad: 'asuncion', zona: 'Recoleta', count: 1 });
    expect(combos).toContainEqual({ categoria: 'restaurantes', ciudad: 'luque', zona: 'Villa Morra', count: 1 });
  });

  it('excludes listings with no zona — there is nothing to name the page after', () => {
    const all: Listing[] = [listing({ id: 'a' }), listing({ id: 'b', zona: '   ' })];
    expect(combosWithZonaListings(all)).toEqual([]);
  });
});
