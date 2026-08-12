import { describe, expect, it } from 'vitest';
import {
  dayHoursToRows,
  galleryToUrls,
  listingToRow,
  rowToCategory,
  rowToCity,
  rowToListing,
  rowsToDayHours,
} from '../lib/db/mappers';
import type { ListingRow } from '../lib/db/schema';
import type { DayHours, Listing } from '../lib/types';
import { CITY_COORDS } from '../lib/cities';

/** A fully populated row, so the mapping is exercised in both directions. */
function row(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: 'r1',
    slug: 'nande-cocina',
    name: 'Ñandé Cocina',
    categoria: 'restaurantes',
    ciudad: 'asuncion',
    subtitle: 'Cocina paraguaya',
    description: 'Cocina paraguaya de raíz.',
    zona: 'Villa Morra',
    address: 'Av. España 1234',
    lat: null,
    lng: null,
    phone: '021 584 220',
    whatsapp: '595981584220',
    email: 'hola@nandecocina.com.py',
    website: 'https://nandecocina.com.py',
    instagram: 'nandecocina',
    coverImage: '/seed/food-1.svg',
    especialidades: ['Sopa paraguaya', 'Chipa guasú'],
    destacadoItem: { title: 'Menú del día', price: 'Gs. 45.000' },
    productos: null,
    servicios: null,
    verified: true,
    premiumUntil: 1893456000,
    rating: null,
    reviewsCount: null,
    yearsActive: 12,
    avgResponseMins: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('rowToListing', () => {
  it('derives the labels and the logo initial instead of reading stored copies', () => {
    const listing = rowToListing(row());
    expect(listing.categoriaLabel).toBe('Restaurante');
    expect(listing.ciudadLabel).toBe('Asunción');
    expect(listing.logoInitial).toBe('Ñ');
  });

  it('falls back to the city centre when the listing has no coordinates of its own', () => {
    const listing = rowToListing(row());
    expect(listing.lat).toBe(CITY_COORDS.asuncion?.lat);
    expect(listing.lng).toBe(CITY_COORDS.asuncion?.lng);
  });

  it('prefers the listing’s own coordinates, parsing MySQL DECIMAL strings', () => {
    const listing = rowToListing(row({ lat: '-25.291000', lng: '-57.581000' }));
    expect(listing.lat).toBe(-25.291);
    expect(listing.lng).toBe(-57.581);
  });

  it('maps NULL to undefined, never to an empty string or a zero', () => {
    const listing = rowToListing(
      row({ subtitle: null, description: null, rating: null, reviewsCount: null, premiumUntil: null }),
    );
    expect(listing.subtitle).toBeUndefined();
    expect(listing.description).toBeUndefined();
    expect(listing.rating).toBeUndefined();
    expect(listing.reviewsCount).toBeUndefined();
    expect(listing.premiumUntil).toBeUndefined();
    expect(listing.verified).toBe(true);
  });

  it('leaves empty child collections undefined so the UI renders nothing', () => {
    const listing = rowToListing(row(), { hours: [], gallery: [] });
    expect(listing.hours).toBeUndefined();
    expect(listing.gallery).toBeUndefined();
  });

  it('attaches hours and gallery when they exist', () => {
    const listing = rowToListing(row(), {
      hours: [{ day: 2, openMinute: 660, closeMinute: 900 }],
      gallery: [
        { url: '/b.svg', position: 1 },
        { url: '/a.svg', position: 0 },
      ],
    });
    expect(listing.hours).toEqual([{ day: 2, ranges: [{ open: '11:00', close: '15:00' }] }]);
    expect(listing.gallery).toEqual(['/a.svg', '/b.svg']);
  });
});

describe('listingToRow', () => {
  it('round-trips a listing through the row shape', () => {
    const original = rowToListing(row({ lat: '-25.291000', lng: '-57.581000' }));
    const roundTripped = rowToListing({ ...row(), ...listingToRow(original) } as ListingRow);

    expect(roundTripped.name).toBe(original.name);
    expect(roundTripped.slug).toBe(original.slug);
    expect(roundTripped.lat).toBe(original.lat);
    expect(roundTripped.especialidades).toEqual(original.especialidades);
    expect(roundTripped.destacadoItem).toEqual(original.destacadoItem);
    expect(roundTripped.verified).toBe(original.verified);
    expect(roundTripped.premiumUntil).toBe(original.premiumUntil);
    expect(roundTripped.yearsActive).toBe(original.yearsActive);
  });

  it('writes NULL rather than inventing a value for an unknown column', () => {
    const listing: Listing = {
      ...rowToListing(row()),
      subtitle: undefined,
      rating: undefined,
      reviewsCount: undefined,
      premiumUntil: undefined,
    };
    const mapped = listingToRow(listing);
    expect(mapped.subtitle).toBeNull();
    expect(mapped.rating).toBeNull();
    expect(mapped.reviewsCount).toBeNull();
    expect(mapped.premiumUntil).toBeNull();
  });
});

describe('hours mapping', () => {
  const hours: DayHours[] = [
    { day: 2, ranges: [{ open: '11:00', close: '15:00' }, { open: '19:00', close: '23:00' }] },
    { day: 5, ranges: [{ open: '19:00', close: '00:00' }] },
  ];

  it('converts to minutes and back without losing a range', () => {
    const rows = dayHoursToRows('r1', hours);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ listingId: 'r1', day: 2, openMinute: 660, closeMinute: 900 });
    expect(rowsToDayHours(rows)).toEqual(hours);
  });

  it('keeps midnight as 00:00 (minute 0), which is what marks an overnight range', () => {
    const rows = dayHoursToRows('r1', [{ day: 5, ranges: [{ open: '19:00', close: '00:00' }] }]);
    expect(rows[0]?.closeMinute).toBe(0);
    expect(rowsToDayHours(rows)[0]?.ranges[0]?.close).toBe('00:00');
  });

  it('groups and orders rows that arrive shuffled', () => {
    const grouped = rowsToDayHours([
      { day: 5, openMinute: 1140, closeMinute: 0 },
      { day: 2, openMinute: 1140, closeMinute: 1380 },
      { day: 2, openMinute: 660, closeMinute: 900 },
    ]);
    expect(grouped.map((d) => d.day)).toEqual([2, 5]);
    expect(grouped[0]?.ranges.map((r) => r.open)).toEqual(['11:00', '19:00']);
  });

  it('returns nothing for a listing with no hours', () => {
    expect(dayHoursToRows('r1', undefined)).toEqual([]);
    expect(rowsToDayHours([])).toEqual([]);
  });
});

describe('taxonomy mapping', () => {
  it('maps a category row, keeping blockKind as the enum the UI switches on', () => {
    expect(
      rowToCategory({
        slug: 'restaurantes',
        label: 'Restaurante',
        labelPlural: 'Restaurantes y cafés',
        icon: 'utensils',
        blockKind: 'food',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toEqual({
      slug: 'restaurantes',
      label: 'Restaurante',
      labelPlural: 'Restaurantes y cafés',
      icon: 'utensils',
      blockKind: 'food',
    });
  });

  it('maps a city row to the two fields the domain type has', () => {
    expect(
      rowToCity({
        slug: 'asuncion',
        label: 'Asunción',
        sortOrder: 0,
        lat: '-25.286700',
        lng: '-57.333300',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toEqual({ slug: 'asuncion', label: 'Asunción' });
  });
});

describe('galleryToUrls', () => {
  it('orders by position, not by insertion order', () => {
    expect(
      galleryToUrls([
        { url: '/c.svg', position: 2 },
        { url: '/a.svg', position: 0 },
        { url: '/b.svg', position: 1 },
      ]),
    ).toEqual(['/a.svg', '/b.svg', '/c.svg']);
  });
});
