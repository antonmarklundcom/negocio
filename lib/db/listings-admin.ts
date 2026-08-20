import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, inArray, isNull, like, lt, ne, or, sql } from 'drizzle-orm';
import { getDb } from './client';
import type { Db } from './connection';
import { requireRole, AuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { logActivity } from './activity-log';
import {
  categories,
  cities,
  listingGallery,
  listingHours,
  listings,
  sales,
  SALE_METHODS,
  type ListingStatus,
  type SaleMethod,
} from './schema';
import { serialiseLines, serialisePiped } from '@/lib/admin/blocks';
import { dayHoursToRows, rowsToDayHours } from './mappers';
import type { DayHours } from '../types';
import type { ListingFormInput } from '@/lib/admin/validation';
import { MAX_GALLERY_IMAGES } from '@/lib/media/upload';
import { MAX_FEATURED_SLOTS } from '@/lib/config';

/**
 * All listing SQL. THIS MODULE IS THE AUTHORIZATION BOUNDARY: every exported
 * function calls `requireRole` as its first statement, before touching the
 * database — mirroring `lib/db/users.ts` exactly.
 *
 * Every function takes `database: Db = getDb()` as its last parameter so tests
 * can inject a fake and assert a rejected call wrote nothing.
 */

export const LISTINGS_PAGE_SIZE = 25;

export interface AdminListingRow {
  id: string;
  slug: string;
  name: string;
  status: ListingStatus;
  categoria: string;
  categoriaLabel: string;
  ciudad: string;
  ciudadLabel: string;
  verified: boolean;
  premiumUntil: number | null;
  featuredUntil: number | null;
  updatedAt: Date;
}

export interface ListingListResult {
  rows: AdminListingRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * The row shape for the edit form, deliberately NOT `Listing`: `rowToListing`
 * fills derived display fields (`categoriaLabel`, `logoInitial`, the
 * city-centre coordinate fallback) that must never be echoed back into a form
 * and re-saved as if they were data. Block fields come back pre-serialised
 * (one line per item) so they drop straight into `AdminForm`'s `defaultValues`.
 */
export interface GalleryImage {
  id: number;
  key: string;
  alt: string | null;
  position: number;
}

export interface AdminListingForm {
  id: string;
  slug: string;
  name: string;
  status: ListingStatus;
  categoria: string;
  ciudad: string;
  subtitle: string | null;
  description: string | null;
  zona: string | null;
  address: string | null;
  lat: string | null;
  lng: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  especialidades: string;
  productos: string;
  servicios: string;
  destacadoTitle: string;
  destacadoDesc: string;
  destacadoPrice: string;
  verified: boolean;
  premiumUntil: number | null;
  featuredUntil: number | null;
  coverImage: string | null;
  hours: DayHours[];
  gallery: GalleryImage[];
  updatedAt: Date;
}

const LIST_COLUMNS = {
  id: listings.id,
  slug: listings.slug,
  name: listings.name,
  status: listings.status,
  categoria: listings.categoria,
  categoriaLabel: categories.label,
  ciudad: listings.ciudad,
  ciudadLabel: cities.label,
  verified: listings.verified,
  premiumUntil: listings.premiumUntil,
  featuredUntil: listings.featuredUntil,
  updatedAt: listings.updatedAt,
} as const;

/** The staleness-dashboard filters (BUILD-SPEC-PR5 §4), so a stat tile links somewhere real. */
export type ListingEstadoFilter = 'por-vencer' | 'vencido' | 'sin-actualizar' | 'sin-contacto';

const STALE_DAYS = 180;

function estadoCondition(estado: ListingEstadoFilter | undefined, nowSeconds: number) {
  if (!estado) return undefined;
  if (estado === 'por-vencer') {
    return and(gt(listings.premiumUntil, nowSeconds), lt(listings.premiumUntil, nowSeconds + 30 * 86400));
  }
  if (estado === 'vencido') {
    return and(lt(listings.premiumUntil, nowSeconds), gt(listings.premiumUntil, nowSeconds - 90 * 86400));
  }
  if (estado === 'sin-actualizar') {
    return sql`${listings.updatedAt} < from_unixtime(${nowSeconds - STALE_DAYS * 86400})`;
  }
  // sin-contacto
  return and(isNull(listings.phone), isNull(listings.whatsapp), isNull(listings.email), isNull(listings.website));
}

export async function listListings(
  actor: SessionUser | null,
  params: {
    q?: string;
    categoria?: string;
    ciudad?: string;
    estado?: ListingEstadoFilter;
    /**
     * Lifecycle filter (ROADMAP W2-1). Absent = every status, because the
     * admin's default question is "show me everything we have", and hiding
     * archived rows by default is how they become invisible rubbish nobody
     * ever cleans up.
     */
    status?: ListingStatus;
    nowSeconds?: number;
    page?: number;
  } = {},
  database: Db = getDb(),
): Promise<ListingListResult> {
  requireRole(actor, ['admin', 'editor']);

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const q = params.q?.trim() ?? '';
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);

  const conditions = [];
  if (q) conditions.push(or(like(listings.name, `%${q}%`), like(listings.slug, `%${q}%`)));
  if (params.categoria) conditions.push(eq(listings.categoria, params.categoria));
  if (params.ciudad) conditions.push(eq(listings.ciudad, params.ciudad));
  if (params.status) conditions.push(eq(listings.status, params.status));
  const estadoWhere = estadoCondition(params.estado, nowSeconds);
  if (estadoWhere) conditions.push(estadoWhere);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // The admin's question is "what did we touch lately", not "what is
  // alphabetically first".
  const rows = await database
    .select(LIST_COLUMNS)
    .from(listings)
    .innerJoin(categories, eq(categories.slug, listings.categoria))
    .innerJoin(cities, eq(cities.slug, listings.ciudad))
    .where(where)
    .orderBy(desc(listings.updatedAt))
    .limit(LISTINGS_PAGE_SIZE)
    .offset((page - 1) * LISTINGS_PAGE_SIZE);

  const [counted] = await database
    .select({ total: sql<number>`count(*)` })
    .from(listings)
    .where(where);

  return { rows, total: Number(counted?.total ?? 0), page, pageSize: LISTINGS_PAGE_SIZE };
}

export async function getListingForEdit(
  actor: SessionUser | null,
  id: string,
  database: Db = getDb(),
): Promise<AdminListingForm | null> {
  requireRole(actor, ['admin', 'editor']);

  const [row] = await database.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!row) return null;

  const [hourRows, galleryRows] = await Promise.all([
    database.select().from(listingHours).where(eq(listingHours.listingId, id)),
    database.select().from(listingGallery).where(eq(listingGallery.listingId, id)).orderBy(asc(listingGallery.position)),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    categoria: row.categoria,
    ciudad: row.ciudad,
    subtitle: row.subtitle,
    description: row.description,
    zona: row.zona,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    website: row.website,
    instagram: row.instagram,
    especialidades: serialiseLines(row.especialidades),
    productos: serialisePiped(row.productos ?? null, ['title', 'price']),
    servicios: serialisePiped(row.servicios ?? null, ['title', 'desc']),
    destacadoTitle: row.destacadoItem?.title ?? '',
    destacadoDesc: row.destacadoItem?.desc ?? '',
    destacadoPrice: row.destacadoItem?.price ?? '',
    coverImage: row.coverImage,
    hours: rowsToDayHours(hourRows),
    gallery: galleryRows.map((g) => ({ id: g.id, key: g.url, alt: g.alt, position: g.position })),
    verified: row.verified,
    premiumUntil: row.premiumUntil,
    featuredUntil: row.featuredUntil,
    updatedAt: row.updatedAt,
  };
}

export async function isListingSlugTaken(
  actor: SessionUser | null,
  slug: string,
  exceptId: string | null,
  database: Db = getDb(),
): Promise<boolean> {
  requireRole(actor, ['admin', 'editor']);
  const where = exceptId === null ? eq(listings.slug, slug) : and(eq(listings.slug, slug), ne(listings.id, exceptId));
  const [row] = await database.select({ id: listings.id }).from(listings).where(where).limit(1);
  return !!row;
}

/**
 * The whole editable field set, for the audit log. `verified`, `premiumUntil`,
 * `rating`, `reviewsCount`, `coverImage`, hours and gallery are NOT part of
 * this projection — this module never touches them, so they never appear in
 * an audit entry it writes.
 */
function auditView(input: ListingFormInput & { slug: string }): Record<string, unknown> {
  return {
    name: input.name,
    slug: input.slug,
    categoria: input.categoria,
    ciudad: input.ciudad,
    subtitle: input.subtitle,
    description: input.description,
    zona: input.zona,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    phone: input.phone,
    whatsapp: input.whatsapp,
    email: input.email,
    website: input.website,
    instagram: input.instagram,
    especialidades: input.especialidades,
    productos: input.productos,
    servicios: input.servicios,
    destacadoItem: input.destacadoItem,
  };
}

/** Same projection, taken straight from a stored row (used for before-snapshots). */
function auditViewFromRow(row: typeof listings.$inferSelect): Record<string, unknown> {
  return {
    name: row.name,
    slug: row.slug,
    categoria: row.categoria,
    ciudad: row.ciudad,
    subtitle: row.subtitle,
    description: row.description,
    zona: row.zona,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    website: row.website,
    instagram: row.instagram,
    especialidades: row.especialidades ?? null,
    productos: row.productos ?? null,
    servicios: row.servicios ?? null,
    destacadoItem: row.destacadoItem ?? null,
  };
}

export async function createListing(
  actor: SessionUser | null,
  input: ListingFormInput,
  database: Db = getDb(),
): Promise<string> {
  const user = requireRole(actor, ['admin', 'editor']);
  if (!input.slug) throw new AuthError('Falta la URL del negocio.', 'forbidden');

  const id = randomUUID();

  return database.transaction(async (tx) => {
    await tx.insert(listings).values({
      id,
      slug: input.slug!,
      name: input.name,
      // Explicit rather than relying on the column default, so the form's
      // choice is what lands (ROADMAP W2-1). Absent means `draft`: a listing
      // created by a caller that does not know about status must not go live.
      status: input.status ?? 'draft',
      categoria: input.categoria,
      ciudad: input.ciudad,
      subtitle: input.subtitle,
      description: input.description,
      zona: input.zona,
      address: input.address,
      lat: input.lat !== null ? String(input.lat) : null,
      lng: input.lng !== null ? String(input.lng) : null,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      website: input.website,
      instagram: input.instagram,
      especialidades: input.especialidades,
      productos: input.productos,
      servicios: input.servicios,
      destacadoItem: input.destacadoItem,
    });

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: id,
      action: 'create',
      after: auditView({ ...input, slug: input.slug! }),
    });

    return id;
  });
}

/**
 * Writes only the columns in the field table of BUILD-SPEC-PR4 §1 — the `set`
 * object is built explicitly, field by field, never by spreading the parsed
 * input. `verified`, `premiumUntil`, `rating`, `reviewsCount`, `coverImage`,
 * hours and gallery are untouched, which is what keeps this editor-facing path
 * physically unable to set them (PR-5's fields).
 */
export async function updateListing(
  actor: SessionUser | null,
  id: string,
  input: ListingFormInput,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const [before] = await tx.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');

    await tx
      .update(listings)
      .set({
        name: input.name,
        categoria: input.categoria,
        ciudad: input.ciudad,
        subtitle: input.subtitle,
        description: input.description,
        zona: input.zona,
        address: input.address,
        lat: input.lat !== null ? String(input.lat) : null,
        lng: input.lng !== null ? String(input.lng) : null,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        website: input.website,
        instagram: input.instagram,
        especialidades: input.especialidades,
        productos: input.productos,
        servicios: input.servicios,
        destacadoItem: input.destacadoItem,
      })
      .where(eq(listings.id, id));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: id,
      action: 'update',
      before: auditViewFromRow(before),
      after: auditView({ ...input, slug: before.slug }),
    });
  });
}

/** Thrown when the delete confirmation does not match the listing's slug. */
export class DeleteNotConfirmedError extends Error {
  constructor() {
    super('Escribí la URL del negocio exactamente como aparece para confirmar.');
    this.name = 'DeleteNotConfirmedError';
  }
}

/**
 * Admin-only: this cascades to `listing_hours` and `listing_gallery`
 * (`onDelete: 'cascade'`), which is unrecoverable.
 *
 * `confirmSlug` must be the listing's own slug, typed back by the person doing
 * it (ROADMAP W1-4). The check lives HERE, not in the form, for the same
 * reason `requireRole` does: a server action is directly reachable over HTTP,
 * so a confirmation implemented only in the UI is decoration. It is compared
 * against the row inside the transaction, so it cannot race an edit either.
 */
export async function deleteListing(
  actor: SessionUser | null,
  id: string,
  confirmSlug: string,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin']);

  await database.transaction(async (tx) => {
    const [before] = await tx.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');
    if (confirmSlug.trim() !== before.slug) throw new DeleteNotConfirmedError();

    await tx.delete(listings).where(eq(listings.id, id));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: id,
      action: 'delete',
      before: auditViewFromRow(before),
    });
  });
}

// ---------------------------------------------------------------------------
// hours (BUILD-SPEC-PR5 §1)
// ---------------------------------------------------------------------------

/**
 * Delete-then-insert, not a diff: the rows have no stable identity (the
 * autoincrement id is not meaningful), a diff would be more code and its bugs
 * would be silent. One small table per listing, inside a transaction, so
 * there is no window where the hours look empty to any reader.
 */
export async function setListingHours(
  actor: SessionUser | null,
  listingId: string,
  hours: DayHours[],
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const existing = await tx.select().from(listingHours).where(eq(listingHours.listingId, listingId));
    const before = rowsToDayHours(existing);

    await tx.delete(listingHours).where(eq(listingHours.listingId, listingId));

    const rows = dayHoursToRows(listingId, hours);
    if (rows.length > 0) await tx.insert(listingHours).values(rows);

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing_hours',
      entityId: listingId,
      action: 'update',
      before: { hours: before },
      after: { hours },
    });
  });
}

// ---------------------------------------------------------------------------
// verified / premiumUntil (BUILD-SPEC-PR5 §3, split in ROADMAP W2-2) — admin
// only, and deliberately SEPARATE functions rather than a widening of
// updateListing: that keeps the editor-facing write path physically unable to
// set either field, which is stronger than a conditional inside one function.
//
// W2-2 split them from each other for the same reason one level down. They are
// two different kinds of claim:
//
//   `verified`     — a HUMAN ASSERTION. Somebody rang the business or walked
//                    in. It is never bought, and it never expires on a clock.
//   `premiumUntil` — a SALE. It has a price, a package and an end date, and it
//                    is (from W2-3) accompanied by a row in `sales`.
//
// Sharing one write path meant saving one silently rewrote the other, the
// activity log could not tell an upsell from a verification, and the future
// `sales` role would have had to be trusted with both to be trusted with
// either. Now `verified` can be granted to a role that must never touch
// billing, and vice versa, without a line of new plumbing.
// ---------------------------------------------------------------------------

export async function setListingVerified(
  actor: SessionUser | null,
  id: string,
  verified: boolean,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin']);

  await database.transaction(async (tx) => {
    const [before] = await tx
      .select({ verified: listings.verified })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');

    await tx.update(listings).set({ verified }).where(eq(listings.id, id));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: id,
      action: 'update',
      before,
      after: { verified },
    });
  });
}

export async function setListingPremiumUntil(
  actor: SessionUser | null,
  id: string,
  premiumUntil: number | null,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin']);

  await database.transaction(async (tx) => {
    const [before] = await tx
      .select({ premiumUntil: listings.premiumUntil })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');

    await tx.update(listings).set({ premiumUntil }).where(eq(listings.id, id));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: id,
      action: 'update',
      before,
      after: { premiumUntil },
    });
  });
}

/**
 * The manual premium sales flow (ROADMAP Phase D item 2): staff sells premium
 * over WhatsApp and invoices outside the app (Pagopar/Bancard/Tigo Money —
 * none of that is this app's concern), then applies the sold package here in
 * one click instead of computing and typing a date.
 *
 * `PREMIUM_PACKAGE_DAYS` are the only durations sold; the query module, not
 * just the UI, is what enforces that — a caller cannot pass an arbitrary
 * number of days.
 *
 * Extends from the CURRENT expiry when the listing is still premium, not from
 * today — a renewal bought before the old package runs out must not shorten
 * what was already paid for. Only falls back to "from today" when the
 * listing is not currently premium (expired or never was).
 */
/**
 * What a package sale records (ROADMAP W2-3 / D5).
 *
 * Amount and method are REQUIRED, not optional-with-a-default. A revenue table
 * with half its rows at ₲0 "because the form let me skip it" is worse than no
 * revenue table: it looks like data and reports nonsense. If a package is
 * genuinely given away, that is `amountGs: 0` typed deliberately.
 */
export interface SaleInput {
  /** Whole guaraníes. The currency has no subunit, so this is never a decimal. */
  amountGs: number;
  method: SaleMethod;
}

/**
 * Re-checked in the query module even though the form validates it, because
 * the form is not the only caller — same reason `assertAssignableRole` exists
 * in `lib/db/users.ts`.
 */
function assertSaleInput(sale: SaleInput): void {
  if (!Number.isInteger(sale.amountGs) || sale.amountGs < 0) {
    throw new AuthError('El monto de la venta tiene que ser un número entero de guaraníes.', 'forbidden');
  }
  if (!SALE_METHODS.includes(sale.method)) {
    throw new AuthError('Ese medio de pago no existe.', 'forbidden');
  }
}

export const PREMIUM_PACKAGE_DAYS = [30, 90, 365] as const;
export type PremiumPackageDays = (typeof PREMIUM_PACKAGE_DAYS)[number];

export async function extendListingPremium(
  actor: SessionUser | null,
  id: string,
  days: PremiumPackageDays,
  nowSeconds: number,
  sale: SaleInput,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin']);
  if (!PREMIUM_PACKAGE_DAYS.includes(days)) {
    throw new AuthError('Ese paquete de premium no existe.', 'forbidden');
  }
  assertSaleInput(sale);

  await database.transaction(async (tx) => {
    const [before] = await tx
      .select({ name: listings.name, verified: listings.verified, premiumUntil: listings.premiumUntil })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');

    const base = before.premiumUntil && before.premiumUntil > nowSeconds ? before.premiumUntil : nowSeconds;
    const premiumUntil = base + days * 86400;

    await tx.update(listings).set({ premiumUntil }).where(eq(listings.id, id));

    // Same transaction as the thing the money bought (ROADMAP W2-3 / D5). A
    // sale recorded afterwards from the route could be lost while the premium
    // still landed, and the books would quietly under-report.
    await tx.insert(sales).values({
      listingId: id,
      listingName: before.name,
      packageKind: 'premium',
      days,
      amountGs: sale.amountGs,
      method: sale.method,
      soldBy: user.id,
    });

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: id,
      action: 'update',
      before: { premiumUntil: before.premiumUntil },
      after: { premiumUntil, packageDays: days },
    });
  });
}

// ---------------------------------------------------------------------------
// "destacado en portada" — home-page featured slots (ROADMAP Phase D item 3)
// ---------------------------------------------------------------------------

/**
 * A fixed number of paid home-page slots (`MAX_FEATURED_SLOTS`, shared with
 * the public home page via `lib/config.ts` so the two can't drift), distinct
 * from Premium: Premium alone competes for the home page's general
 * destacados section, which shrinks as more businesses go premium, so a
 * featured slot is sold separately to guarantee a spot. The cap is enforced
 * here, not just by how many buttons the UI happens to show.
 */
export { MAX_FEATURED_SLOTS };
export const FEATURED_PACKAGE_DAYS = [30, 90] as const;
export type FeaturedPackageDays = (typeof FEATURED_PACKAGE_DAYS)[number];

/** Same extend-from-current-expiry-or-today shape as `extendListingPremium`. */
export async function extendListingFeatured(
  actor: SessionUser | null,
  id: string,
  days: FeaturedPackageDays,
  nowSeconds: number,
  sale: SaleInput,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin']);
  if (!FEATURED_PACKAGE_DAYS.includes(days)) {
    throw new AuthError('Ese paquete de portada no existe.', 'forbidden');
  }
  assertSaleInput(sale);

  await database.transaction(async (tx) => {
    const [before] = await tx
      .select({ name: listings.name, featuredUntil: listings.featuredUntil })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');

    const alreadyFeatured = !!before.featuredUntil && before.featuredUntil > nowSeconds;
    if (!alreadyFeatured) {
      // Renewing an already-featured listing never counts against the cap —
      // only a NEW slot can fill it up.
      const [counted] = await tx
        .select({ total: sql<number>`count(*)` })
        .from(listings)
        .where(gt(listings.featuredUntil, nowSeconds));
      if (Number(counted?.total ?? 0) >= MAX_FEATURED_SLOTS) {
        throw new AuthError(
          `Ya hay ${MAX_FEATURED_SLOTS} negocios destacados en portada, el máximo. Esperá a que venza uno.`,
          'forbidden',
        );
      }
    }

    const base = alreadyFeatured ? before.featuredUntil! : nowSeconds;
    const featuredUntil = base + days * 86400;

    await tx.update(listings).set({ featuredUntil }).where(eq(listings.id, id));

    await tx.insert(sales).values({
      listingId: id,
      listingName: before.name,
      packageKind: 'featured',
      days,
      amountGs: sale.amountGs,
      method: sale.method,
      soldBy: user.id,
    });

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: id,
      action: 'update',
      before: { featuredUntil: before.featuredUntil },
      after: { featuredUntil, packageDays: days },
    });
  });
}

/** Removes a listing's featured slot immediately, freeing it up for another business. */
export async function removeListingFeatured(
  actor: SessionUser | null,
  id: string,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin']);

  await database.transaction(async (tx) => {
    const [before] = await tx
      .select({ featuredUntil: listings.featuredUntil })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');

    await tx.update(listings).set({ featuredUntil: null }).where(eq(listings.id, id));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: id,
      action: 'update',
      before: { featuredUntil: before.featuredUntil },
      after: { featuredUntil: null },
    });
  });
}

// ---------------------------------------------------------------------------
// gallery (BUILD-SPEC-PR5 §2.4)
// ---------------------------------------------------------------------------

/**
 * Every gallery mutation filters on BOTH `listingId` and `imageId` — an image
 * id alone is an object reference from a URL, and filtering on it alone would
 * let a crafted id touch another listing's row (ROADMAP rule 4). A row that
 * does not exist and a row that belongs to someone else look identical here
 * on purpose (ROADMAP rule 5): both simply are not found by this query.
 */
async function galleryRowsFor(tx: Pick<Db, 'select'>, listingId: string) {
  return tx.select().from(listingGallery).where(eq(listingGallery.listingId, listingId)).orderBy(asc(listingGallery.position));
}

/** Renormalises positions to 0..n-1 and rewrites the whole set, exactly like hours — the unique (listing_id, position) index means a naive swap collides mid-update. */
async function rewriteGallery(
  tx: Db,
  listingId: string,
  rows: { url: string; alt: string | null }[],
): Promise<void> {
  await tx.delete(listingGallery).where(eq(listingGallery.listingId, listingId));
  if (rows.length === 0) return;
  await tx.insert(listingGallery).values(rows.map((r, i) => ({ listingId, url: r.url, alt: r.alt, position: i })));
}

export async function addGalleryImage(
  actor: SessionUser | null,
  listingId: string,
  key: string,
  alt: string | null,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const existing = await galleryRowsFor(tx, listingId);
    if (existing.length >= MAX_GALLERY_IMAGES) {
      throw new AuthError(`Ya hay ${MAX_GALLERY_IMAGES} fotos, el máximo por negocio.`, 'forbidden');
    }

    const next = [...existing.map((r) => ({ url: r.url, alt: r.alt })), { url: key, alt }];
    await rewriteGallery(tx, listingId, next);

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing_gallery',
      entityId: listingId,
      action: 'create',
      after: { added: key },
    });
  });
}

export async function updateGalleryAlt(
  actor: SessionUser | null,
  listingId: string,
  imageId: number,
  alt: string | null,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const existing = await galleryRowsFor(tx, listingId);
    const target = existing.find((r) => r.id === imageId);
    if (!target) throw new AuthError('No encontramos esa foto.', 'forbidden');

    await tx.update(listingGallery).set({ alt }).where(and(eq(listingGallery.id, imageId), eq(listingGallery.listingId, listingId)));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing_gallery',
      entityId: listingId,
      action: 'update',
      before: { alt: target.alt },
      after: { alt },
    });
  });
}

export async function moveGalleryImage(
  actor: SessionUser | null,
  listingId: string,
  imageId: number,
  dir: 'up' | 'down',
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const existing = await galleryRowsFor(tx, listingId);
    const index = existing.findIndex((r) => r.id === imageId);
    if (index === -1) throw new AuthError('No encontramos esa foto.', 'forbidden');

    const swapWith = dir === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= existing.length) return; // already at the edge; a no-op, not an error

    const reordered = [...existing];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];

    await rewriteGallery(
      tx,
      listingId,
      reordered.map((r) => ({ url: r.url, alt: r.alt })),
    );

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing_gallery',
      entityId: listingId,
      action: 'update',
      before: { order: existing.map((r) => r.id) },
      after: { order: reordered.map((r) => r.id) },
    });
  });
}

/** Deleting a row does not delete the R2 object — storage is cheap and an orphan is recoverable; a deleted object is not. */
export async function removeGalleryImage(
  actor: SessionUser | null,
  listingId: string,
  imageId: number,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const existing = await galleryRowsFor(tx, listingId);
    const target = existing.find((r) => r.id === imageId);
    if (!target) throw new AuthError('No encontramos esa foto.', 'forbidden');

    const remaining = existing.filter((r) => r.id !== imageId).map((r) => ({ url: r.url, alt: r.alt }));
    await rewriteGallery(tx, listingId, remaining);

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing_gallery',
      entityId: listingId,
      action: 'delete',
      before: { removed: target.url },
    });
  });
}

/**
 * The cover key is an OBJECT REFERENCE, not a value (Phase B rule 4): it comes
 * from the request, and without this check any signed-in editor could point
 * one business's cover at another business's photo — or at an arbitrary
 * storage key that renders as a broken image on a public page. So the key must
 * be one of THIS listing's own gallery rows.
 *
 * `null` (clear the cover) is the one value that needs no gallery row.
 *
 * Row-not-found and key-not-yours deliberately return the same message
 * (rule 5): a different answer would say whether a given storage key exists.
 */
export async function setCoverImage(
  actor: SessionUser | null,
  listingId: string,
  key: string | null,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const [before] = await tx.select({ coverImage: listings.coverImage }).from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');

    if (key !== null) {
      const own = await galleryRowsFor(tx, listingId);
      if (!own.some((r) => r.url === key)) {
        throw new AuthError('No encontramos esa foto.', 'forbidden');
      }
    }

    await tx.update(listings).set({ coverImage: key }).where(eq(listings.id, listingId));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: listingId,
      action: 'update',
      before: { coverImage: before.coverImage },
      after: { coverImage: key },
    });
  });
}

// ---------------------------------------------------------------------------
// staleness / expiry dashboard (BUILD-SPEC-PR5 §4)
// ---------------------------------------------------------------------------

export interface StalenessSummary {
  porVencer: number;
  vencido: number;
  sinActualizar: number;
  sinContacto: number;
  topPorVencer: AdminListingRow[];
}

/** `nowSeconds` is computed in Node and passed in — nothing here calls NOW(). */
export async function listingStaleness(
  actor: SessionUser | null,
  nowSeconds: number,
  database: Db = getDb(),
): Promise<StalenessSummary> {
  requireRole(actor, ['admin', 'editor']);

  const countWhere = (where: ReturnType<typeof estadoCondition>) =>
    database
      .select({ total: sql<number>`count(*)` })
      .from(listings)
      .where(where)
      .then(([r]) => Number(r?.total ?? 0));

  const [porVencer, vencido, sinActualizar, sinContacto, topPorVencer] = await Promise.all([
    countWhere(estadoCondition('por-vencer', nowSeconds)),
    countWhere(estadoCondition('vencido', nowSeconds)),
    countWhere(estadoCondition('sin-actualizar', nowSeconds)),
    countWhere(estadoCondition('sin-contacto', nowSeconds)),
    database
      .select(LIST_COLUMNS)
      .from(listings)
      .innerJoin(categories, eq(categories.slug, listings.categoria))
      .innerJoin(cities, eq(cities.slug, listings.ciudad))
      .where(estadoCondition('por-vencer', nowSeconds))
      .orderBy(asc(listings.premiumUntil))
      .limit(5),
  ]);

  return { porVencer, vencido, sinActualizar, sinContacto, topPorVencer };
}

/**
 * Listings with the same name in the same city (ROADMAP W2-6).
 *
 * A WARNING, never a block. Two real businesses genuinely share a name in one
 * city — franchises, "Farmacia San Roque" on two corners — so refusing the
 * write would make the admin unable to record reality. But typing a business
 * in twice is the single most common data-quality failure on a directory, and
 * once both rows exist neither is obviously the wrong one.
 *
 * Case-insensitive by collation (the column is `utf8mb4_..._ci`), and it
 * excludes the row being edited so saving an existing listing never warns
 * about itself.
 */
export interface DuplicateCandidate {
  id: string;
  slug: string;
  name: string;
}

export async function findDuplicateListings(
  actor: SessionUser | null,
  name: string,
  ciudad: string,
  excludeId: string | null = null,
  database: Db = getDb(),
): Promise<DuplicateCandidate[]> {
  requireRole(actor, ['admin', 'editor']);

  const trimmed = name.trim();
  if (!trimmed || !ciudad) return [];

  const conditions = [eq(listings.name, trimmed), eq(listings.ciudad, ciudad)];
  if (excludeId) conditions.push(ne(listings.id, excludeId));

  return database
    .select({ id: listings.id, slug: listings.slug, name: listings.name })
    .from(listings)
    .where(and(...conditions))
    .limit(5);
}

/** Thrown when a bulk re-categorisation names a category that does not exist. */
export class UnknownCategoryError extends Error {
  constructor(slug: string) {
    super(`No existe el rubro "${slug}".`);
    this.name = 'UnknownCategoryError';
  }
}

/**
 * Move several listings to another rubro in one transaction (ROADMAP W2-6).
 *
 * This exists to unblock category deletion: `deleteCategory` refuses while
 * listings are attached (PR-4 open question 2), and the only alternative was
 * opening each listing and changing one select. On a rubro with forty
 * businesses that is not a workflow, it is a reason nobody ever tidies the
 * taxonomy.
 *
 * The target category is checked against the table, not against the form's
 * options: the ids arrive from the request and so does the target
 * (Phase B rule 4). One `activity_log` row per listing, inside the same
 * transaction as the update — the audit trail must show which businesses
 * moved, not that "a bulk action happened".
 */
export async function recategoriseListings(
  actor: SessionUser | null,
  ids: string[],
  categoria: string,
  database: Db = getDb(),
): Promise<number> {
  const user = requireRole(actor, ['admin', 'editor']);

  const unique = [...new Set(ids.filter((id) => id.trim() !== ''))];
  if (unique.length === 0) return 0;

  return database.transaction(async (tx) => {
    const [target] = await tx
      .select({ slug: categories.slug })
      .from(categories)
      .where(eq(categories.slug, categoria))
      .limit(1);
    if (!target) throw new UnknownCategoryError(categoria);

    const rows = await tx
      .select({ id: listings.id, categoria: listings.categoria })
      .from(listings)
      .where(inArray(listings.id, unique));

    // Silently ignore ids that do not exist rather than failing the whole
    // batch: the same answer as row-not-found everywhere else, and a partial
    // selection going stale mid-edit is ordinary, not an attack.
    const moving = rows.filter((row) => row.categoria !== categoria);
    if (moving.length === 0) return 0;

    await tx
      .update(listings)
      .set({ categoria })
      .where(inArray(listings.id, moving.map((row) => row.id)));

    for (const row of moving) {
      await logActivity(tx, {
        userId: user.id,
        entityType: 'listing',
        entityId: row.id,
        action: 'update',
        before: { categoria: row.categoria },
        after: { categoria },
      });
    }

    return moving.length;
  });
}

// ---------------------------------------------------------------------------
// lifecycle (ROADMAP W2-1 / D2)
// ---------------------------------------------------------------------------

/**
 * Move a listing between `draft`, `published` and `archived`.
 *
 * Archiving REPLACES hard deletion for the ordinary case. "This business
 * closed" used to mean losing the row, its hours, its gallery — and, because
 * the audit trail keys on the id, an entity_id nobody can look up any more.
 * An archived listing keeps all of it, disappears from the public site and the
 * sitemap immediately, and can come back with one click if the business
 * reopens or somebody archived the wrong row.
 *
 * `deleteListing` stays (admin-only, typed-slug confirmation) for the case
 * archiving cannot serve: a test row or a duplicate, where leaving it in the
 * admin forever is the wrong answer.
 *
 * Editors may archive and publish. That is the same standing they already have
 * over a listing's content, and withholding it would mean every closed
 * business waits for an admin.
 */
export async function setListingStatus(
  actor: SessionUser | null,
  id: string,
  status: ListingStatus,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const [before] = await tx
      .select({ status: listings.status })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');

    await tx.update(listings).set({ status }).where(eq(listings.id, id));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'listing',
      entityId: id,
      // `archive` is its own action in the enum, so the audit trail
      // distinguishes "took this off the site" from "edited a field".
      action: status === 'archived' ? 'archive' : 'update',
      before,
      after: { status },
    });
  });
}

// ---------------------------------------------------------------------------
// expiry digest (ROADMAP W2-4)
// ---------------------------------------------------------------------------

export interface ExpiringListing {
  id: string;
  slug: string;
  name: string;
  ciudadLabel: string;
  premiumUntil: number | null;
  featuredUntil: number | null;
}

/**
 * Listings whose premium OR featured slot ends within `withinSeconds`
 * (ROADMAP W2-4). Both, in one list, because the sales conversation is about
 * the business and not about the product: telling someone their premium
 * expires on Friday and only mentioning next week that their portada slot
 * expired on Saturday is two calls where one would do.
 *
 * `nowSeconds` is passed in — nothing here calls NOW(), same as everywhere
 * else in this module. Already-expired rows are excluded: this is the "call
 * them before it lapses" list, and the dashboard's `vencido` count is the
 * other one.
 */
export async function listExpiringSoon(
  actor: SessionUser | null,
  nowSeconds: number,
  withinSeconds: number,
  database: Db = getDb(),
): Promise<ExpiringListing[]> {
  requireRole(actor, ['admin', 'editor']);

  const until = nowSeconds + withinSeconds;
  const soon = (column: typeof listings.premiumUntil | typeof listings.featuredUntil) =>
    and(gt(column, nowSeconds), lt(column, until));

  return database
    .select({
      id: listings.id,
      slug: listings.slug,
      name: listings.name,
      ciudadLabel: cities.label,
      premiumUntil: listings.premiumUntil,
      featuredUntil: listings.featuredUntil,
    })
    .from(listings)
    .innerJoin(cities, eq(cities.slug, listings.ciudad))
    .where(or(soon(listings.premiumUntil), soon(listings.featuredUntil)))
    .orderBy(asc(sql`least(coalesce(${listings.premiumUntil}, 9999999999), coalesce(${listings.featuredUntil}, 9999999999))`))
    .limit(200);
}
