import {
  bigint,
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import type { DayHours, Listing, Review } from '../types';

/**
 * The database schema, derived from `lib/types.ts` — the app's own domain
 * contract — and never from an external CMS's field names.
 *
 * Two shape decisions are made here and cannot be changed later without a
 * hand-applied migration:
 *
 *  - `hours` and `gallery` are child tables, because they are *queried*:
 *    hours drives "Abierto ahora" (a WHERE clause), gallery is ordered and
 *    premium-gated.
 *  - the category-block fields (`especialidades`, `productos`, `servicios`,
 *    `destacadoItem`) are JSON columns, because they are render-only. Nothing
 *    filters, sorts or joins on them.
 *
 * Honesty rule: a column that seed data has no real answer for is nullable.
 * Nothing here fabricates a value to satisfy NOT NULL. `verified` defaults to
 * false; `rating`/`reviewsCount` stay NULL until real data exists.
 */

/** Category-block payloads, typed so the JSON columns are not `any`. */
type DestacadoItem = NonNullable<Listing['destacadoItem']>;
type Producto = NonNullable<Listing['productos']>[number];
type Servicio = NonNullable<Listing['servicios']>[number];

export const BLOCK_KINDS = ['food', 'shop', 'service', 'default'] as const;

export const categories = mysqlTable('categories', {
  slug: varchar('slug', { length: 64 }).primaryKey(),
  label: varchar('label', { length: 120 }).notNull(),
  labelPlural: varchar('label_plural', { length: 120 }).notNull(),
  icon: varchar('icon', { length: 64 }).notNull(),
  blockKind: mysqlEnum('block_kind', BLOCK_KINDS).notNull(),
  /** Presentation order; the taxonomy is curated, not alphabetical. */
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const cities = mysqlTable('cities', {
  slug: varchar('slug', { length: 64 }).primaryKey(),
  label: varchar('label', { length: 120 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  /** City-centre coordinates, used as a map fallback for listings without their own. */
  lat: decimal('lat', { precision: 9, scale: 6 }),
  lng: decimal('lng', { precision: 9, scale: 6 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const listings = mysqlTable(
  'listings',
  {
    /** Stable public id (`Listing.id`). Assigned by the importer, kept forever. */
    id: varchar('id', { length: 64 }).primaryKey(),
    slug: varchar('slug', { length: 191 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),

    // The taxonomy is a foreign key, not free text: a listing pointing at a
    // rubro that does not exist renders its raw slug as a label.
    categoria: varchar('categoria', { length: 64 })
      .notNull()
      .references(() => categories.slug, { onDelete: 'restrict', onUpdate: 'cascade' }),
    ciudad: varchar('ciudad', { length: 64 })
      .notNull()
      .references(() => cities.slug, { onDelete: 'restrict', onUpdate: 'cascade' }),
    subtitle: varchar('subtitle', { length: 200 }),
    description: text('description'),

    zona: varchar('zona', { length: 120 }),
    address: varchar('address', { length: 255 }),
    lat: decimal('lat', { precision: 9, scale: 6 }),
    lng: decimal('lng', { precision: 9, scale: 6 }),

    phone: varchar('phone', { length: 40 }),
    /** E.164 digits for wa.me — no '+', no spaces. */
    whatsapp: varchar('whatsapp', { length: 20 }),
    email: varchar('email', { length: 160 }),
    website: varchar('website', { length: 255 }),
    instagram: varchar('instagram', { length: 80 }),

    coverImage: varchar('cover_image', { length: 255 }),

    // Render-only category block. See the note at the top of this file.
    especialidades: json('especialidades').$type<string[]>(),
    destacadoItem: json('destacado_item').$type<DestacadoItem>(),
    productos: json('productos').$type<Producto[]>(),
    servicios: json('servicios').$type<Servicio[]>(),

    /** Never set from a form; a dated human assertion (PR-5). */
    verified: boolean('verified').notNull().default(false),
    /** Unix seconds. Premium while it is in the future. */
    premiumUntil: bigint('premium_until', { mode: 'number' }),
    /**
     * Unix seconds. "Destacado en portada" (Phase D item 3) — a home-page
     * featured slot, sold and tracked separately from `premiumUntil`: Premium
     * alone competes for the home page's general destacados section, which
     * shrinks as more businesses go premium; a featured slot guarantees a
     * spot. Slot count is enforced in `lib/db/listings-admin.ts`, not here.
     */
    featuredUntil: bigint('featured_until', { mode: 'number' }),

    // Honesty-gated stats: NULL unless real data exists (§6.6).
    rating: decimal('rating', { precision: 2, scale: 1 }),
    reviewsCount: int('reviews_count'),
    yearsActive: int('years_active'),
    avgResponseMins: int('avg_response_mins'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('listings_slug_idx').on(t.slug),
    categoriaIdx: index('listings_categoria_idx').on(t.categoria),
    ciudadIdx: index('listings_ciudad_idx').on(t.ciudad),
    categoriaCiudadIdx: index('listings_categoria_ciudad_idx').on(t.categoria, t.ciudad),
    zonaIdx: index('listings_zona_idx').on(t.zona),
    premiumIdx: index('listings_premium_until_idx').on(t.premiumUntil),
    featuredIdx: index('listings_featured_until_idx').on(t.featuredUntil),
  }),
);

/**
 * Opening hours, one row per contiguous range. Minutes-from-midnight rather
 * than a string, because the open-now check is a numeric comparison in SQL.
 * A range whose close is <= its open crosses midnight (23:00 → 02:00), and
 * "00:00" as a close time means midnight, i.e. `closeMinute = 0`.
 */
export const listingHours = mysqlTable(
  'listing_hours',
  {
    id: int('id').autoincrement().primaryKey(),
    listingId: varchar('listing_id', { length: 64 })
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    /** 0 = Sunday … 6 = Saturday (JS getDay convention, as in `DayHours`). */
    day: tinyint('day').notNull(),
    openMinute: smallint('open_minute').notNull(),
    closeMinute: smallint('close_minute').notNull(),
  },
  (t) => ({
    listingDayIdx: index('listing_hours_listing_day_idx').on(t.listingId, t.day),
    uniqueRange: uniqueIndex('listing_hours_unique_range').on(t.listingId, t.day, t.openMinute),
  }),
);

/** Ordered gallery images (premium-gated at render time). */
export const listingGallery = mysqlTable(
  'listing_gallery',
  {
    id: int('id').autoincrement().primaryKey(),
    listingId: varchar('listing_id', { length: 64 })
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    url: varchar('url', { length: 255 }).notNull(),
    position: int('position').notNull(),
    alt: varchar('alt', { length: 200 }),
  },
  (t) => ({
    uniquePosition: uniqueIndex('listing_gallery_unique_position').on(t.listingId, t.position),
  }),
);

export const LEAD_SOURCES = [
  'listing_message',
  'listing_whatsapp',
  'sumate',
  'contacto',
] as const;

/**
 * Persisted leads. Today every lead is fired at a webhook and forgotten — if
 * the webhook is down the lead is gone and there is no history. This table is
 * the prerequisite for the monthly per-business lead report (ROADMAP Phase D
 * item 1). Columns are the union of the lead variants in `lib/leads.ts`, so
 * every one of them is nullable except the discriminator and the timestamp.
 */
export const leads = mysqlTable(
  'leads',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    source: mysqlEnum('source', LEAD_SOURCES).notNull(),

    // listing_message / listing_whatsapp. Deliberately NOT a foreign key: a
    // lead is history and must outlive the listing it came from.
    listingId: varchar('listing_id', { length: 64 }),
    listingSlug: varchar('listing_slug', { length: 191 }),
    message: text('message'),

    // sumate
    businessName: varchar('business_name', { length: 160 }),
    category: varchar('category', { length: 80 }),
    city: varchar('city', { length: 80 }),

    // shared contact details across variants
    name: varchar('name', { length: 120 }),
    contact: varchar('contact', { length: 160 }),
    email: varchar('email', { length: 160 }),
    phone: varchar('phone', { length: 40 }),

    /** How many webhook sinks accepted it, and how many were configured. */
    deliveredSinks: int('delivered_sinks'),
    configuredSinks: int('configured_sinks'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    listingCreatedIdx: index('leads_listing_created_idx').on(t.listingId, t.createdAt),
    sourceCreatedIdx: index('leads_source_created_idx').on(t.source, t.createdAt),
  }),
);

/**
 * Staff and (from PR-6) business-owner accounts.
 *
 * The enum carries all four role values from day one even though only `admin`
 * and `editor` are assignable today: widening a MySQL enum later is an ALTER on
 * the live database, and the values cost nothing to reserve. The code surface is
 * honestly two roles — `lib/auth/roles.ts` grants the owner roles nothing, and
 * the users form offers only the staff pair.
 */
export const USER_ROLES = ['admin', 'editor', 'owner_admin', 'owner_editor'] as const;
export const STAFF_ROLES = ['admin', 'editor'] as const;
export const USER_STATUSES = ['active', 'suspended'] as const;

export const users = mysqlTable(
  'users',
  {
    id: int('id').autoincrement().primaryKey(),
    email: varchar('email', { length: 160 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    /**
     * Nullable so an invited-but-unset account can exist without a usable
     * credential. That state must fail login with the SAME message as a wrong
     * password — see `lib/auth/login.ts`.
     */
    passwordHash: varchar('password_hash', { length: 255 }),
    role: mysqlEnum('role', USER_ROLES).notNull(),
    status: mysqlEnum('status', USER_STATUSES).notNull().default('active'),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
);

export const ACTIVITY_ACTIONS = ['create', 'update', 'delete', 'archive'] as const;

/**
 * The audit trail. Written from inside the same transaction as every mutation
 * (`lib/db/activity-log.ts`), never from a route.
 *
 * `entity_id` is a VARCHAR, not an INT — a deliberate deviation from the
 * reference implementation. This schema keys `listings` on a varchar id and
 * `categories`/`cities` on their slug, so an integer column could not log the
 * site's three main entities at all.
 *
 * `user_id` is SET NULL on delete: an actor may leave, the record of what they
 * did may not.
 */
export const activityLog = mysqlTable(
  'activity_log',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    userId: int('user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    entityType: varchar('entity_type', { length: 32 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }).notNull(),
    action: mysqlEnum('action', ACTIVITY_ACTIONS).notNull(),
    beforeJson: json('before_json').$type<Record<string, unknown>>(),
    afterJson: json('after_json').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index('activity_log_entity_idx').on(t.entityType, t.entityId),
    createdIdx: index('activity_log_created_idx').on(t.createdAt),
  }),
);

export type ListingRow = typeof listings.$inferSelect;
export type ListingInsert = typeof listings.$inferInsert;
export type ListingHoursRow = typeof listingHours.$inferSelect;
export type ListingGalleryRow = typeof listingGallery.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type CityRow = typeof cities.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;
export type LeadInsert = typeof leads.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type ActivityLogRow = typeof activityLog.$inferSelect;
export type ActivityLogInsert = typeof activityLog.$inferInsert;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
export type BlockKind = (typeof BLOCK_KINDS)[number];
export type LeadSource = (typeof LEAD_SOURCES)[number];

// Re-exported so the mapper's intent is readable next to the table it maps.
export type { DayHours, Listing, Review };
