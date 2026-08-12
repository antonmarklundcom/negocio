import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, like, ne, or, sql } from 'drizzle-orm';
import { getDb } from './client';
import type { Db } from './connection';
import { requireRole, AuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { logActivity } from './activity-log';
import { categories, cities, listings } from './schema';
import { serialiseLines, serialisePiped } from '@/lib/admin/blocks';
import type { ListingFormInput } from '@/lib/admin/validation';

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
  categoria: string;
  categoriaLabel: string;
  ciudad: string;
  ciudadLabel: string;
  verified: boolean;
  premiumUntil: number | null;
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
export interface AdminListingForm {
  id: string;
  slug: string;
  name: string;
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
  updatedAt: Date;
}

const LIST_COLUMNS = {
  id: listings.id,
  slug: listings.slug,
  name: listings.name,
  categoria: listings.categoria,
  categoriaLabel: categories.label,
  ciudad: listings.ciudad,
  ciudadLabel: cities.label,
  verified: listings.verified,
  premiumUntil: listings.premiumUntil,
  updatedAt: listings.updatedAt,
} as const;

export async function listListings(
  actor: SessionUser | null,
  params: { q?: string; categoria?: string; ciudad?: string; page?: number } = {},
  database: Db = getDb(),
): Promise<ListingListResult> {
  requireRole(actor, ['admin', 'editor']);

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const q = params.q?.trim() ?? '';

  const conditions = [];
  if (q) conditions.push(or(like(listings.name, `%${q}%`), like(listings.slug, `%${q}%`)));
  if (params.categoria) conditions.push(eq(listings.categoria, params.categoria));
  if (params.ciudad) conditions.push(eq(listings.ciudad, params.ciudad));
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

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
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
    verified: row.verified,
    premiumUntil: row.premiumUntil,
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

/**
 * Admin-only: this cascades to `listing_hours` and `listing_gallery`
 * (`onDelete: 'cascade'`), which is unrecoverable.
 */
export async function deleteListing(actor: SessionUser | null, id: string, database: Db = getDb()): Promise<void> {
  const user = requireRole(actor, ['admin']);

  await database.transaction(async (tx) => {
    const [before] = await tx.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!before) throw new AuthError('No encontramos ese negocio.', 'forbidden');

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
