import { describe, expect, it } from 'vitest';
import {
  approxDistanceKm,
  COORD_PRECISION,
  formatDistance,
  isValidPoint,
  lngScaleAt,
  parsePoint,
  roundCoord,
} from '@/lib/geo';
import { pageWindow } from '@/lib/pagination-window';
import { rankSimilar, similarQuery, SIMILAR_LIMIT } from '@/lib/similar';
import { applyQuery } from '@/lib/providers/query';
import { sortPlan } from '@/lib/db/query-helpers';
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

// Two points in Asunción — the Panteón downtown and Villa Morra — ~6 km apart.
const PANTEON = { lat: -25.2822, lng: -57.6353 };
const VILLA_MORRA = { lat: -25.2966, lng: -57.5745 };

describe('geo — coordinate handling', () => {
  it('rounds to COORD_PRECISION places, so a URL never carries a house-level fix', () => {
    expect(COORD_PRECISION).toBe(3);
    expect(roundCoord(-25.2822471)).toBe(-25.282);
    expect(roundCoord(-57.6353998)).toBe(-57.635);
  });

  it('rejects out-of-range and non-numeric coordinates instead of throwing', () => {
    expect(parsePoint('-25.2822', '-57.6353')).toEqual({ lat: -25.282, lng: -57.635 });
    expect(parsePoint('91', '0')).toBeUndefined();
    expect(parsePoint('0', '181')).toBeUndefined();
    expect(parsePoint('abc', '0')).toBeUndefined();
    expect(parsePoint(undefined, '-57.6')).toBeUndefined();
    expect(parsePoint('-25.2', undefined)).toBeUndefined();
  });

  it('treats a listing with only one coordinate as un-geocoded', () => {
    expect(isValidPoint({ lat: -25.2, lng: undefined })).toBe(false);
    expect(isValidPoint({ lat: undefined, lng: -57.6 })).toBe(false);
    expect(isValidPoint({ lat: -25.2, lng: -57.6 })).toBe(true);
  });

  it('measures a known Asunción distance to within a few hundred metres', () => {
    const km = approxDistanceKm(PANTEON, VILLA_MORRA);
    expect(km).toBeGreaterThan(6);
    expect(km).toBeLessThan(7);
    // Symmetric to well under the precision we keep.
    expect(Math.abs(km - approxDistanceKm(VILLA_MORRA, PANTEON))).toBeLessThan(0.05);
  });

  it('scales longitude by cos(lat) — the same number the SQL ORDER BY binds', () => {
    expect(lngScaleAt(0)).toBeCloseTo(1, 10);
    expect(lngScaleAt(-25.28)).toBeCloseTo(Math.cos((-25.28 * Math.PI) / 180), 12);
  });

  it('formats distance the way the rest of the site writes numbers', () => {
    expect(formatDistance(0.42)).toBe('420 m');
    expect(formatDistance(2.64)).toBe('2,6 km');
    expect(formatDistance(41.2)).toBe('41 km');
  });
});

describe('applyQuery — sort: cerca', () => {
  const near = listing({ id: 'near', name: 'Zeta', lat: -25.283, lng: -57.636 });
  const far = listing({ id: 'far', name: 'Alfa', lat: -25.35, lng: -57.5 });
  const nowhere = listing({ id: 'nowhere', name: 'Beta' });
  const all = [nowhere, far, near];

  it('orders by distance, not by name or premium', () => {
    const { items } = applyQuery(all, { sort: 'cerca', near: PANTEON });
    expect(items.map((l) => l.id)).toEqual(['near', 'far', 'nowhere']);
  });

  it('puts un-geocoded listings last rather than treating them as nearest', () => {
    const { items } = applyQuery([nowhere, near], { sort: 'cerca', near: PANTEON });
    expect(items[0]!.id).toBe('near');
  });

  it('falls back to relevancia when the visitor gave no position', () => {
    // No `near`: a declined location prompt must not empty or scramble the page.
    const { items } = applyQuery(all, { sort: 'cerca' });
    expect(items.map((l) => l.name)).toEqual(['Alfa', 'Beta', 'Zeta']);
  });
});

describe('applyQuery — sort: calificacion', () => {
  const all = [
    listing({ id: 'unrated', name: 'Alfa' }),
    listing({ id: 'low', name: 'Beta', rating: 3.2 }),
    listing({ id: 'high', name: 'Zeta', rating: 4.8 }),
  ];

  it('ranks rated listings above unrated ones, best first', () => {
    const { items } = applyQuery(all, { sort: 'calificacion' });
    expect(items.map((l) => l.id)).toEqual(['high', 'low', 'unrated']);
  });

  it('keeps unrated listings together at the end, in name order', () => {
    const { items } = applyQuery(
      [
        listing({ id: 'z-unrated', name: 'Zeta' }),
        listing({ id: 'a-unrated', name: 'Alfa' }),
        listing({ id: 'rated', name: 'Mu', rating: 1 }),
      ],
      { sort: 'calificacion' },
    );
    expect(items.map((l) => l.id)).toEqual(['rated', 'a-unrated', 'z-unrated']);
  });
});

describe('sortPlan — the DB provider agrees with the in-memory one', () => {
  it('asks for distance ordering only when a point is present', () => {
    expect(sortPlan({ sort: 'cerca', near: PANTEON }).distanceFirst).toBe(true);
    expect(sortPlan({ sort: 'cerca' }).distanceFirst).toBe(false);
    // …and without a point it is plain relevancia, exactly like applyQuery.
    expect(sortPlan({ sort: 'cerca' })).toEqual(sortPlan({ sort: 'relevancia' }));
  });

  it('asks for rating ordering and nothing else on calificacion', () => {
    expect(sortPlan({ sort: 'calificacion' })).toEqual({
      premiumFirst: false,
      verifiedFirst: false,
      ratingFirst: true,
      distanceFirst: false,
    });
  });
});

describe('applyQuery — excludeId', () => {
  it('drops the excluded listing before pagination counts it', () => {
    const all = [listing({ id: 'a', name: 'A' }), listing({ id: 'b', name: 'B' })];
    const { items, total } = applyQuery(all, { excludeId: 'a' });
    expect(items.map((l) => l.id)).toEqual(['b']);
    expect(total).toBe(1);
  });
});

describe('similar businesses', () => {
  const subject = listing({ id: 'me', slug: 'me', name: 'Mi Negocio', zona: 'Villa Morra' });

  it('asks for the same rubro and city, and never for itself', () => {
    const q = similarQuery(subject);
    expect(q.categoria).toBe('restaurantes');
    expect(q.ciudad).toBe('asuncion');
    expect(q.excludeId).toBe('me');
  });

  it('prefers the same barrio without filtering the others out', () => {
    const ranked = rankSimilar(subject, [
      listing({ id: 'other-zona', name: 'A', zona: 'Recoleta' }),
      listing({ id: 'same-zona', name: 'Z', zona: 'villa morra' }),
    ]);
    expect(ranked.map((l) => l.id)).toEqual(['same-zona', 'other-zona']);
  });

  it('does not treat two blank barrios as the same barrio', () => {
    // The candidate with no zona is listed SECOND on purpose. If blank matched
    // blank it would be hoisted to the front, so the assertion fails on the bug
    // rather than passing by coincidence — `zona` is blank on most rows, and
    // "same barrio" quietly meaning "neither has one" would reorder the whole
    // block around a field nobody filled in.
    const noZona = listing({ id: 'me2', name: 'Mi Otro' });
    const ranked = rankSimilar(noZona, [
      listing({ id: 'named', name: 'A', zona: 'Recoleta' }),
      listing({ id: 'blank', name: 'Z' }),
    ]);
    expect(ranked.map((l) => l.id)).toEqual(['named', 'blank']);
  });

  it('keeps the provider ordering inside a barrio group (stable sort)', () => {
    const ranked = rankSimilar(subject, [
      listing({ id: 'first', name: 'A', zona: 'Villa Morra' }),
      listing({ id: 'second', name: 'B', zona: 'Villa Morra' }),
    ]);
    expect(ranked.map((l) => l.id)).toEqual(['first', 'second']);
  });

  it('never returns the subject even if the provider hands it back', () => {
    expect(rankSimilar(subject, [subject])).toEqual([]);
  });

  it('caps at SIMILAR_LIMIT', () => {
    const many = Array.from({ length: 20 }, (_, i) => listing({ id: `c${i}`, name: `C${i}` }));
    expect(rankSimilar(subject, many)).toHaveLength(SIMILAR_LIMIT);
  });
});

describe('pageWindow', () => {
  it('renders nothing to page through when there is one page or none', () => {
    expect(pageWindow(1, 0)).toEqual([]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it('lists every page when the current one sits in the middle', () => {
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('elides from the very first page too — the window is bounded either side', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 'gap', 5]);
  });

  it('keeps first, last and the current neighbourhood, and elides the rest', () => {
    expect(pageWindow(10, 84)).toEqual([1, 'gap', 9, 10, 11, 'gap', 84]);
    expect(pageWindow(1, 84)).toEqual([1, 2, 'gap', 84]);
    expect(pageWindow(84, 84)).toEqual([1, 'gap', 83, 84]);
  });

  it('spells out a gap of exactly one page instead of hiding it behind an ellipsis', () => {
    // 1 … 3 4 5 would hide page 2 to save nothing.
    expect(pageWindow(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('never renders a page number outside 1..totalPages, whatever the URL said', () => {
    for (const page of [0, -5, 999, Number.NaN]) {
      const slots = pageWindow(page, 7);
      for (const s of slots) {
        if (s === 'gap') continue;
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(7);
      }
    }
  });

  it('is bounded no matter how large the directory gets', () => {
    expect(pageWindow(5000, 10_000).length).toBeLessThanOrEqual(7);
  });
});
