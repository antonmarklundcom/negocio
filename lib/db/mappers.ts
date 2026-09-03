import type { Category, City, DayHours, Listing } from '../types';
import type {
  CategoryRow,
  CityRow,
  ListingGalleryRow,
  ListingHoursRow,
  ListingInsert,
  ListingRow,
} from './schema';
import { categoryLabel } from '../categories';
import { cityLabel, CITY_COORDS } from '../cities';
import { initialOf } from '../format';
import { toHHMM, toMinutes } from './open-now';
import { computeSearchText } from './query-helpers';

/**
 * Row ↔ domain mapping. Pure, so it is unit-testable without MySQL — which is
 * the point: everything above `lib/db/` speaks `Listing`/`Category`/`City` and
 * never sees a row.
 *
 * `categoriaLabel`, `ciudadLabel` and `logoInitial` are derived, not stored:
 * they are a function of the taxonomy and the name, and storing them would let
 * them drift.
 */

/** MySQL DECIMAL comes back as a string; keep the parse in exactly one place. */
function toNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

function nonEmpty<T>(value: T[] | null | undefined): T[] | undefined {
  return value && value.length > 0 ? value : undefined;
}

/** Hour rows → `DayHours[]`, grouped by day and ordered by opening time. */
export function rowsToDayHours(rows: Pick<ListingHoursRow, 'day' | 'openMinute' | 'closeMinute'>[]): DayHours[] {
  const byDay = new Map<number, { open: string; close: string }[]>();
  for (const row of [...rows].sort((a, b) => a.day - b.day || a.openMinute - b.openMinute)) {
    const ranges = byDay.get(row.day) ?? [];
    ranges.push({ open: toHHMM(row.openMinute), close: toHHMM(row.closeMinute) });
    byDay.set(row.day, ranges);
  }
  return [...byDay.entries()].map(([day, ranges]) => ({ day: day as DayHours['day'], ranges }));
}

/** `DayHours[]` → hour rows for one listing. Inverse of `rowsToDayHours`. */
export function dayHoursToRows(
  listingId: string,
  hours: DayHours[] | undefined,
): { listingId: string; day: number; openMinute: number; closeMinute: number }[] {
  if (!hours) return [];
  return hours.flatMap((dh) =>
    dh.ranges.map((r) => ({
      listingId,
      day: dh.day,
      openMinute: toMinutes(r.open),
      closeMinute: toMinutes(r.close),
    })),
  );
}

export function galleryToUrls(rows: Pick<ListingGalleryRow, 'url' | 'position'>[]): string[] {
  return [...rows].sort((a, b) => a.position - b.position).map((r) => r.url);
}

/** Row + children → the `Listing` every page and component consumes. */
export function rowToListing(
  row: ListingRow,
  children: {
    hours?: Pick<ListingHoursRow, 'day' | 'openMinute' | 'closeMinute'>[];
    gallery?: Pick<ListingGalleryRow, 'url' | 'position'>[];
  } = {},
): Listing {
  // A listing without its own coordinates falls back to the city centre, the
  // same way the seed provider does. The fallback happens on read: the column
  // stores only coordinates that are actually the business's own.
  const cityCoords = CITY_COORDS[row.ciudad];
  const lat = toNumber(row.lat) ?? cityCoords?.lat;
  const lng = toNumber(row.lng) ?? cityCoords?.lng;

  const hours = rowsToDayHours(children.hours ?? []);
  const gallery = galleryToUrls(children.gallery ?? []);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,

    categoria: row.categoria,
    categoriaLabel: categoryLabel(row.categoria),
    subtitle: orUndefined(row.subtitle),
    description: orUndefined(row.description),

    ciudad: row.ciudad,
    ciudadLabel: cityLabel(row.ciudad),
    zona: orUndefined(row.zona),
    address: orUndefined(row.address),
    lat,
    lng,

    phone: orUndefined(row.phone),
    whatsapp: orUndefined(row.whatsapp),
    email: orUndefined(row.email),
    website: orUndefined(row.website),
    instagram: orUndefined(row.instagram),

    logoInitial: initialOf(row.name),
    coverImage: orUndefined(row.coverImage),
    gallery: nonEmpty(gallery),

    hours: nonEmpty(hours),

    especialidades: nonEmpty(row.especialidades),
    destacadoItem: orUndefined(row.destacadoItem),
    productos: nonEmpty(row.productos),
    servicios: nonEmpty(row.servicios),

    status: row.status,
    verified: row.verified,
    premiumUntil: orUndefined(row.premiumUntil),
    featuredUntil: orUndefined(row.featuredUntil),
    updatedAt: Math.floor(row.updatedAt.getTime() / 1000),

    rating: toNumber(row.rating),
    reviewsCount: orUndefined(row.reviewsCount),
    yearsActive: orUndefined(row.yearsActive),
    avgResponseMins: orUndefined(row.avgResponseMins),
  };
}

/**
 * `Listing` → an insertable row. Undefined becomes NULL: nothing here invents a
 * value to satisfy a column, and `verified` is never inferred.
 *
 * Callers must pass the business's *own* coordinates or none at all — the
 * city-centre fallback is a rendering decision (see `rowToListing`) and must
 * not be written back as if it were a fact about the business.
 */
export function listingToRow(listing: Listing): ListingInsert {
  return {
    id: listing.id,
    slug: listing.slug,
    name: listing.name,

    categoria: listing.categoria,
    ciudad: listing.ciudad,
    subtitle: listing.subtitle ?? null,
    description: listing.description ?? null,

    zona: listing.zona ?? null,
    address: listing.address ?? null,
    lat: listing.lat !== undefined ? String(listing.lat) : null,
    lng: listing.lng !== undefined ? String(listing.lng) : null,

    // Kept in sync on every write (ROADMAP F3) so `search_text` never lags
    // behind the fields it is derived from — see the column comment in
    // `./schema.ts` and `computeSearchText` in `./query-helpers.ts`.
    searchText: computeSearchText(listing),

    phone: listing.phone ?? null,
    whatsapp: listing.whatsapp ?? null,
    email: listing.email ?? null,
    website: listing.website ?? null,
    instagram: listing.instagram ?? null,

    coverImage: listing.coverImage ?? null,

    especialidades: listing.especialidades ?? null,
    destacadoItem: listing.destacadoItem ?? null,
    productos: listing.productos ?? null,
    servicios: listing.servicios ?? null,

    verified: listing.verified,
    premiumUntil: listing.premiumUntil ?? null,
    featuredUntil: listing.featuredUntil ?? null,

    rating: listing.rating !== undefined ? String(listing.rating) : null,
    reviewsCount: listing.reviewsCount ?? null,
    yearsActive: listing.yearsActive ?? null,
    avgResponseMins: listing.avgResponseMins ?? null,
  };
}

export function rowToCategory(row: CategoryRow): Category {
  return {
    slug: row.slug,
    label: row.label,
    labelPlural: row.labelPlural,
    icon: row.icon,
    blockKind: row.blockKind,
  };
}

export function rowToCity(row: CityRow): City {
  return { slug: row.slug, label: row.label };
}
