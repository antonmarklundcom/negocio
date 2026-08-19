import 'server-only';
import { asc, eq, like, sql } from 'drizzle-orm';
import { getDb } from './client';
import type { Db } from './connection';
import { requireRole, AuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { logActivity } from './activity-log';
import { categories, cities, listings, type BlockKind } from './schema';
import type { CategoryFormInput, CityFormInput } from '@/lib/admin/validation';

/**
 * All category (rubro) and city (ciudad) SQL. Same authorization shape as
 * `lib/db/users.ts` and `lib/db/listings-admin.ts`: `requireRole` first, every
 * write logged inside its transaction, every function takes `database` last so
 * a test can inject a fake and assert a rejected call wrote nothing.
 */

export const TAXONOMY_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------

export interface AdminCategoryRow {
  slug: string;
  label: string;
  labelPlural: string;
  icon: string;
  blockKind: BlockKind;
  sortOrder: number;
}

export interface CategoryListResult {
  rows: AdminCategoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

const CATEGORY_COLUMNS = {
  slug: categories.slug,
  label: categories.label,
  labelPlural: categories.labelPlural,
  icon: categories.icon,
  blockKind: categories.blockKind,
  sortOrder: categories.sortOrder,
} as const;

export async function listCategories(
  actor: SessionUser | null,
  params: { q?: string; page?: number } = {},
  database: Db = getDb(),
): Promise<CategoryListResult> {
  requireRole(actor, ['admin', 'editor']);

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const q = params.q?.trim() ?? '';
  const where = q ? like(categories.label, `%${q}%`) : undefined;

  // The curated order is the point — not alphabetical.
  const rows = await database
    .select(CATEGORY_COLUMNS)
    .from(categories)
    .where(where)
    .orderBy(asc(categories.sortOrder), asc(categories.label))
    .limit(TAXONOMY_PAGE_SIZE)
    .offset((page - 1) * TAXONOMY_PAGE_SIZE);

  const [counted] = await database
    .select({ total: sql<number>`count(*)` })
    .from(categories)
    .where(where);

  return { rows, total: Number(counted?.total ?? 0), page, pageSize: TAXONOMY_PAGE_SIZE };
}

export async function getCategory(
  actor: SessionUser | null,
  slug: string,
  database: Db = getDb(),
): Promise<AdminCategoryRow | null> {
  requireRole(actor, ['admin', 'editor']);
  const [row] = await database.select(CATEGORY_COLUMNS).from(categories).where(eq(categories.slug, slug)).limit(1);
  return row ?? null;
}

export async function isCategorySlugTaken(
  actor: SessionUser | null,
  slug: string,
  database: Db = getDb(),
): Promise<boolean> {
  requireRole(actor, ['admin', 'editor']);
  const [row] = await database.select({ slug: categories.slug }).from(categories).where(eq(categories.slug, slug)).limit(1);
  return !!row;
}

function categoryAuditView(input: CategoryFormInput & { slug: string }): Record<string, unknown> {
  return {
    slug: input.slug,
    label: input.label,
    labelPlural: input.labelPlural,
    icon: input.icon,
    blockKind: input.blockKind,
    sortOrder: input.sortOrder,
  };
}

export async function createCategory(
  actor: SessionUser | null,
  input: CategoryFormInput,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);
  if (!input.slug) throw new AuthError('Falta la URL del rubro.', 'forbidden');

  await database.transaction(async (tx) => {
    await tx.insert(categories).values({
      slug: input.slug!,
      label: input.label,
      labelPlural: input.labelPlural,
      icon: input.icon,
      blockKind: input.blockKind,
      sortOrder: input.sortOrder,
    });
    // `entityId` is the slug — exactly why `activity_log.entity_id` is a VARCHAR.
    await logActivity(tx, {
      userId: user.id,
      entityType: 'category',
      entityId: input.slug!,
      action: 'create',
      after: categoryAuditView({ ...input, slug: input.slug! }),
    });
  });
}

export async function updateCategory(
  actor: SessionUser | null,
  slug: string,
  input: CategoryFormInput,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const [before] = await tx.select(CATEGORY_COLUMNS).from(categories).where(eq(categories.slug, slug)).limit(1);
    if (!before) throw new AuthError('No encontramos ese rubro.', 'forbidden');

    await tx
      .update(categories)
      .set({
        label: input.label,
        labelPlural: input.labelPlural,
        icon: input.icon,
        blockKind: input.blockKind,
        sortOrder: input.sortOrder,
      })
      .where(eq(categories.slug, slug));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'category',
      entityId: slug,
      action: 'update',
      before: categoryAuditView(before),
      after: categoryAuditView({ ...input, slug }),
    });
  });
}

/**
 * Admin-only. Counts listings first, inside the transaction, and refuses with
 * the count rather than letting the `onDelete: 'restrict'` FK turn it into a
 * 500 — the editor gets a sentence, not a stack trace.
 */
export async function deleteCategory(actor: SessionUser | null, slug: string, database: Db = getDb()): Promise<void> {
  const user = requireRole(actor, ['admin']);

  await database.transaction(async (tx) => {
    const [before] = await tx.select(CATEGORY_COLUMNS).from(categories).where(eq(categories.slug, slug)).limit(1);
    if (!before) throw new AuthError('No encontramos ese rubro.', 'forbidden');

    const [counted] = await tx
      .select({ total: sql<number>`count(*)` })
      .from(listings)
      .where(eq(listings.categoria, slug));
    const count = Number(counted?.total ?? 0);
    if (count > 0) {
      throw new AuthError(`No podés borrar un rubro con ${count} negocios. Movelos primero.`, 'forbidden');
    }

    await tx.delete(categories).where(eq(categories.slug, slug));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'category',
      entityId: slug,
      action: 'delete',
      before: categoryAuditView(before),
    });
  });
}

export async function countListingsByCategory(
  actor: SessionUser | null,
  database: Db = getDb(),
): Promise<Record<string, number>> {
  requireRole(actor, ['admin', 'editor']);
  const rows = await database
    .select({ categoria: listings.categoria, total: sql<number>`count(*)` })
    .from(listings)
    .groupBy(listings.categoria);
  return Object.fromEntries(rows.map((r) => [r.categoria, Number(r.total)]));
}

// ---------------------------------------------------------------------------
// cities
// ---------------------------------------------------------------------------

export interface AdminCityRow {
  slug: string;
  label: string;
  sortOrder: number;
  lat: string | null;
  lng: string | null;
}

export interface CityListResult {
  rows: AdminCityRow[];
  total: number;
  page: number;
  pageSize: number;
}

const CITY_COLUMNS = {
  slug: cities.slug,
  label: cities.label,
  sortOrder: cities.sortOrder,
  lat: cities.lat,
  lng: cities.lng,
} as const;

export async function listCities(
  actor: SessionUser | null,
  params: { q?: string; page?: number } = {},
  database: Db = getDb(),
): Promise<CityListResult> {
  requireRole(actor, ['admin', 'editor']);

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const q = params.q?.trim() ?? '';
  const where = q ? like(cities.label, `%${q}%`) : undefined;

  const rows = await database
    .select(CITY_COLUMNS)
    .from(cities)
    .where(where)
    .orderBy(asc(cities.sortOrder), asc(cities.label))
    .limit(TAXONOMY_PAGE_SIZE)
    .offset((page - 1) * TAXONOMY_PAGE_SIZE);

  const [counted] = await database
    .select({ total: sql<number>`count(*)` })
    .from(cities)
    .where(where);

  return { rows, total: Number(counted?.total ?? 0), page, pageSize: TAXONOMY_PAGE_SIZE };
}

export async function getCityAdmin(
  actor: SessionUser | null,
  slug: string,
  database: Db = getDb(),
): Promise<AdminCityRow | null> {
  requireRole(actor, ['admin', 'editor']);
  const [row] = await database.select(CITY_COLUMNS).from(cities).where(eq(cities.slug, slug)).limit(1);
  return row ?? null;
}

export async function isCitySlugTaken(
  actor: SessionUser | null,
  slug: string,
  database: Db = getDb(),
): Promise<boolean> {
  requireRole(actor, ['admin', 'editor']);
  const [row] = await database.select({ slug: cities.slug }).from(cities).where(eq(cities.slug, slug)).limit(1);
  return !!row;
}

function cityAuditView(input: CityFormInput & { slug: string }): Record<string, unknown> {
  return { slug: input.slug, label: input.label, sortOrder: input.sortOrder, lat: input.lat, lng: input.lng };
}

function cityAuditViewFromRow(row: AdminCityRow): Record<string, unknown> {
  return { slug: row.slug, label: row.label, sortOrder: row.sortOrder, lat: row.lat, lng: row.lng };
}

export async function createCity(actor: SessionUser | null, input: CityFormInput, database: Db = getDb()): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);
  if (!input.slug) throw new AuthError('Falta la URL de la ciudad.', 'forbidden');

  await database.transaction(async (tx) => {
    await tx.insert(cities).values({
      slug: input.slug!,
      label: input.label,
      sortOrder: input.sortOrder,
      lat: input.lat !== null ? String(input.lat) : null,
      lng: input.lng !== null ? String(input.lng) : null,
    });
    await logActivity(tx, {
      userId: user.id,
      entityType: 'city',
      entityId: input.slug!,
      action: 'create',
      after: cityAuditView({ ...input, slug: input.slug! }),
    });
  });
}

export async function updateCity(
  actor: SessionUser | null,
  slug: string,
  input: CityFormInput,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);

  await database.transaction(async (tx) => {
    const [before] = await tx.select(CITY_COLUMNS).from(cities).where(eq(cities.slug, slug)).limit(1);
    if (!before) throw new AuthError('No encontramos esa ciudad.', 'forbidden');

    await tx
      .update(cities)
      .set({
        label: input.label,
        sortOrder: input.sortOrder,
        lat: input.lat !== null ? String(input.lat) : null,
        lng: input.lng !== null ? String(input.lng) : null,
      })
      .where(eq(cities.slug, slug));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'city',
      entityId: slug,
      action: 'update',
      before: cityAuditViewFromRow(before),
      after: cityAuditView({ ...input, slug }),
    });
  });
}

export async function deleteCity(actor: SessionUser | null, slug: string, database: Db = getDb()): Promise<void> {
  const user = requireRole(actor, ['admin']);

  await database.transaction(async (tx) => {
    const [before] = await tx.select(CITY_COLUMNS).from(cities).where(eq(cities.slug, slug)).limit(1);
    if (!before) throw new AuthError('No encontramos esa ciudad.', 'forbidden');

    const [counted] = await tx
      .select({ total: sql<number>`count(*)` })
      .from(listings)
      .where(eq(listings.ciudad, slug));
    const count = Number(counted?.total ?? 0);
    if (count > 0) {
      throw new AuthError(`No podés borrar una ciudad con ${count} negocios. Movelos primero.`, 'forbidden');
    }

    await tx.delete(cities).where(eq(cities.slug, slug));

    await logActivity(tx, {
      userId: user.id,
      entityType: 'city',
      entityId: slug,
      action: 'delete',
      before: cityAuditViewFromRow(before),
    });
  });
}

export async function countListingsByCity(actor: SessionUser | null, database: Db = getDb()): Promise<Record<string, number>> {
  requireRole(actor, ['admin', 'editor']);
  const rows = await database
    .select({ ciudad: listings.ciudad, total: sql<number>`count(*)` })
    .from(listings)
    .groupBy(listings.ciudad);
  return Object.fromEntries(rows.map((r) => [r.ciudad, Number(r.total)]));
}

/**
 * Every category / every city, unpaginated, for the admin's own SELECT options
 * and for the create-form validation (ROADMAP W2-6).
 *
 * THE ADMIN MUST NOT READ `getCategories()` / `getCities()` FROM
 * `lib/listings-repo.ts`. Those are the PUBLIC reads, and they deliberately
 * return only taxonomy that already has at least one listing — a rubro with
 * nothing in it must not appear in the site's navigation. Used by the admin
 * that filter is a trap with no way out: a category or city created in
 * `/admin/rubros` or `/admin/ciudades` was absent from the new-listing form's
 * select AND rejected by the create validation, so it could never be assigned
 * to anything, so it never gained a listing, so it never became selectable.
 *
 * Found by the W1-6 admin e2e suite. Guarded like everything else in this
 * module; `editor` is allowed because an editor creates listings and therefore
 * needs the options.
 */
export interface TaxonomyOption {
  value: string;
  label: string;
}

export async function listAllCategoryOptions(
  actor: SessionUser | null,
  database: Db = getDb(),
): Promise<TaxonomyOption[]> {
  requireRole(actor, ['admin', 'editor']);

  const rows = await database
    .select({ value: categories.slug, label: categories.label })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.label));
  return rows;
}

export async function listAllCityOptions(
  actor: SessionUser | null,
  database: Db = getDb(),
): Promise<TaxonomyOption[]> {
  requireRole(actor, ['admin', 'editor']);

  const rows = await database
    .select({ value: cities.slug, label: cities.label })
    .from(cities)
    .orderBy(asc(cities.sortOrder), asc(cities.label));
  return rows;
}
