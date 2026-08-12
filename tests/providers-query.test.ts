import { describe, expect, it } from 'vitest';
import { applyQuery } from '@/lib/providers/query';
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

describe('isPremium (regression guard — unaffected by the featured-slot addition)', () => {
  it('is still independent of featuredUntil', () => {
    expect(isPremium(listing({ premiumUntil: FUTURE, featuredUntil: PAST }))).toBe(true);
    expect(isPremium(listing({ premiumUntil: PAST, featuredUntil: FUTURE }))).toBe(false);
  });
});
