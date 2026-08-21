import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/auth/password';
import {
  BLOCK_KINDS,
  REVIEW_STATUSES,
  LISTING_STATUSES,
  SALE_METHODS,
  STAFF_ROLES,
  USER_STATUSES,
  type BlockKind,
  type ListingStatus,
  type SaleMethod,
  type ReviewStatus,
  type UserRole,
  type UserStatus,
} from '@/lib/db/schema';
import { parseLines, parsePipedLines } from './blocks';
import { toMinutes } from '@/lib/db/open-now';
import type { DayHours } from '@/lib/types';

/**
 * All admin form validation, for every entity, in one pure module.
 *
 * PURE means: `FormData` in, `{ok, data} | {ok:false, errors}` out. No
 * database, no session, no clock, no `fetch`. That is what lets every rule be
 * unit-tested without MySQL, and it is why this file is the only validation
 * style in the admin — a second one would not be covered by those tests.
 *
 * Errors accumulate into one object and are returned whole, so the form shows
 * every problem at once instead of one per submit.
 */

export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

type Errors = Record<string, string>;

function value(fd: FormData, name: string): string {
  const raw = fd.get(name);
  return typeof raw === 'string' ? raw.trim() : '';
}

function requireStr(fd: FormData, name: string, label: string, maxLength: number, errors: Errors): string {
  const v = value(fd, name);
  if (!v) {
    errors[name] = `${label} es obligatorio.`;
  } else if (v.length > maxLength) {
    errors[name] = `${label} no puede superar los ${maxLength} caracteres.`;
  }
  return v;
}

/**
 * Deliberately permissive: one `@`, something either side, no spaces. Anything
 * stricter rejects valid addresses, and the real proof that an address works is
 * a mail that arrives.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireEmail(fd: FormData, name: string, errors: Errors): string {
  const v = value(fd, name).toLowerCase();
  if (!v) {
    errors[name] = 'El correo es obligatorio.';
  } else if (v.length > 160) {
    errors[name] = 'El correo no puede superar los 160 caracteres.';
  } else if (!EMAIL_PATTERN.test(v)) {
    errors[name] = 'Escribí un correo válido.';
  }
  return v;
}

/**
 * An empty select is the ONLY unselected state and it fails here. Nothing in
 * this module ever substitutes a default for a value the app does not know.
 */
function requireEnum<T extends string>(
  fd: FormData,
  name: string,
  label: string,
  allowed: readonly T[],
  errors: Errors,
): T | undefined {
  const v = value(fd, name);
  if (!v) {
    errors[name] = `Elegí ${label}.`;
    return undefined;
  }
  if (!(allowed as readonly string[]).includes(v)) {
    errors[name] = `Ese valor de ${label} no es válido.`;
    return undefined;
  }
  return v as T;
}

/**
 * A public-URL slug: lowercase alphanumerics separated by single hyphens, no
 * leading/trailing hyphen. Shared by listings, categories and cities — all
 * three are FK targets or public routes, so the rule must not drift between
 * them.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireSlug(fd: FormData, name: string, maxLength: number, errors: Errors): string {
  const v = value(fd, name);
  if (!v) {
    errors[name] = 'La URL es obligatoria.';
  } else if (v.length > maxLength) {
    errors[name] = `La URL no puede superar los ${maxLength} caracteres.`;
  } else if (!SLUG_PATTERN.test(v)) {
    errors[name] = 'Usá solo minúsculas, números y guiones simples (sin espacios ni guion al principio o al final).';
  }
  return v;
}

/**
 * Empty is valid: an optional email field that is simply unset. `requireEmail`
 * above is for `users`, where an email always exists.
 */
function optionalEmail(fd: FormData, name: string, errors: Errors): string | null {
  const v = value(fd, name).toLowerCase();
  if (!v) return null;
  if (v.length > 160) {
    errors[name] = 'El correo no puede superar los 160 caracteres.';
  } else if (!EMAIL_PATTERN.test(v)) {
    errors[name] = 'Escribí un correo válido.';
  }
  return v;
}

function optionalStr(fd: FormData, name: string, label: string, maxLength: number, errors: Errors): string | null {
  const v = value(fd, name);
  if (v && v.length > maxLength) {
    errors[name] = `${label} no puede superar los ${maxLength} caracteres.`;
  }
  return v || null;
}

function requireInt(fd: FormData, name: string, label: string, min: number, errors: Errors): number | undefined {
  const raw = value(fd, name);
  const n = Number(raw);
  if (raw === '' || !Number.isInteger(n) || n < min) {
    errors[name] = `${label} tiene que ser un número entero, ${min} o mayor.`;
    return undefined;
  }
  return n;
}

export interface Coordinates {
  lat: number | null;
  lng: number | null;
}

/**
 * `lat`/`lng` as paired optional text fields. Text, not `type: 'number'` — a
 * browser number input with the Paraguayan comma-decimal keyboard default
 * submits an empty string and the coordinate silently vanishes.
 *
 * Both blank → `{lat: null, lng: null}` (allowed; the map falls back to the
 * city centre at render time — never written back as if it were the
 * business's own location). One filled without the other is a field error on
 * the blank one.
 */
function parseCoordinates(fd: FormData, errors: Errors): Coordinates {
  const rawLat = value(fd, 'lat');
  const rawLng = value(fd, 'lng');

  if (!rawLat && !rawLng) return { lat: null, lng: null };
  if (!rawLat) {
    errors['lat'] = 'Poné las dos coordenadas o ninguna.';
  }
  if (!rawLng) {
    errors['lng'] = 'Poné las dos coordenadas o ninguna.';
  }
  if (!rawLat || !rawLng) return { lat: null, lng: null };

  const lat = Number(rawLat.replace(',', '.'));
  const lng = Number(rawLng.replace(',', '.'));

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors['lat'] = 'La latitud tiene que estar entre -90 y 90.';
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    errors['lng'] = 'La longitud tiene que estar entre -180 y 180.';
  }
  return { lat, lng };
}

// ---------------------------------------------------------------------------
// listings
// ---------------------------------------------------------------------------

export interface ListingBlockFields {
  especialidades: string[] | null;
  productos: { title: string; price?: string }[] | null;
  servicios: { title: string; desc?: string }[] | null;
  destacadoItem: { title: string; desc?: string; price?: string } | null;
}

export interface ListingFormInput extends ListingBlockFields {
  name: string;
  slug?: string; // present on create only
  /**
   * Lifecycle (ROADMAP W2-1). Present on create only: after that it moves
   * through its own buttons, not through the big edit form, so that saving a
   * phone number can never accidentally publish a draft or un-archive a
   * closed business.
   */
  status?: 'draft' | 'published';
  categoria: string;
  ciudad: string;
  subtitle: string | null;
  description: string | null;
  zona: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
}

function parseServicios(fd: FormData, errors: Errors): { title: string; desc?: string }[] | null {
  const raw = value(fd, 'servicios');
  if (!raw) return null;
  const result = parsePipedLines(raw, ['title', 'desc']);
  if (!result.ok) {
    errors['servicios'] = result.error.message;
    return null;
  }
  if (result.rows.length === 0) return null;
  return result.rows.map((r) => (r.desc ? { title: r.title!, desc: r.desc } : { title: r.title! }));
}

function parseProductos(fd: FormData, errors: Errors): { title: string; price?: string }[] | null {
  const raw = value(fd, 'productos');
  if (!raw) return null;
  const result = parsePipedLines(raw, ['title', 'price']);
  if (!result.ok) {
    errors['productos'] = result.error.message;
    return null;
  }
  if (result.rows.length === 0) return null;
  return result.rows.map((r) => (r.price ? { title: r.title!, price: r.price } : { title: r.title! }));
}

function parseEspecialidades(fd: FormData): string[] | null {
  const raw = value(fd, 'especialidades');
  if (!raw) return null;
  const lines = parseLines(raw);
  return lines.length > 0 ? lines : null;
}

/**
 * `destacadoItem` is `null` unless `destacadoTitle` is filled. A price or
 * description without a title is a field error on the title — a block with no
 * title cannot render.
 */
function parseDestacadoItem(fd: FormData, errors: Errors): { title: string; desc?: string; price?: string } | null {
  const title = value(fd, 'destacadoTitle');
  const desc = value(fd, 'destacadoDesc');
  const price = value(fd, 'destacadoPrice');

  if (!title) {
    if (desc || price) {
      errors['destacadoTitle'] = 'Un destacado necesita un título.';
    }
    return null;
  }
  const item: { title: string; desc?: string; price?: string } = { title };
  if (desc) item.desc = desc;
  if (price) item.price = price;
  return item;
}

/**
 * `categories`/`cities` are passed in as the currently valid slugs, not
 * imported from `lib/categories.ts` / `lib/cities.ts` — the form must offer
 * what is in the database, or an editor can pick a rubro that no longer
 * exists and the FK rejects the insert with a 500.
 */
export function parseListingInput(
  fd: FormData,
  mode: 'create' | 'update',
  validCategories: readonly string[],
  validCities: readonly string[],
): ParseResult<ListingFormInput> {
  const errors: Errors = {};

  const name = requireStr(fd, 'name', 'El nombre', 200, errors);
  const slug = mode === 'create' ? requireSlug(fd, 'slug', 191, errors) : undefined;
  const categoria = requireEnum(fd, 'categoria', 'un rubro', validCategories, errors);
  const ciudad = requireEnum(fd, 'ciudad', 'una ciudad', validCities, errors);

  const subtitle = optionalStr(fd, 'subtitle', 'El subtítulo', 200, errors);
  const description = optionalStr(fd, 'description', 'La descripción', 2000, errors);
  const zona = optionalStr(fd, 'zona', 'La zona', 120, errors);
  const address = optionalStr(fd, 'address', 'La dirección', 255, errors);

  const { lat, lng } = parseCoordinates(fd, errors);

  const phone = optionalStr(fd, 'phone', 'El teléfono', 40, errors);
  const whatsapp = optionalStr(fd, 'whatsapp', 'El WhatsApp', 20, errors);
  const email = optionalEmail(fd, 'email', errors);
  const website = optionalStr(fd, 'website', 'El sitio web', 255, errors);
  const instagram = optionalStr(fd, 'instagram', 'El usuario de Instagram', 80, errors);

  const especialidades = parseEspecialidades(fd);
  const productos = parseProductos(fd, errors);
  const servicios = parseServicios(fd, errors);
  const destacadoItem = parseDestacadoItem(fd, errors);

  // Create only, and only ever `draft` or `published` (ROADMAP W2-1). An
  // unrecognised value falls back to `draft`, never to `published`: a typo, an
  // old cached form or a hand-rolled POST must not be able to put something on
  // the public site. Archiving is a separate, explicit action.
  const status =
    mode === 'create' ? (value(fd, 'status') === 'published' ? 'published' : 'draft') : undefined;

  if (Object.keys(errors).length > 0 || !categoria || !ciudad) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      ...(slug !== undefined ? { slug } : {}),
      ...(status !== undefined ? { status } : {}),
      categoria,
      ciudad,
      subtitle,
      description,
      zona,
      address,
      lat,
      lng,
      phone,
      whatsapp,
      email,
      website,
      instagram,
      especialidades,
      productos,
      servicios,
      destacadoItem,
    },
  };
}

// ---------------------------------------------------------------------------
// categories (rubros)
// ---------------------------------------------------------------------------

export interface CategoryFormInput {
  slug?: string; // create only
  label: string;
  labelPlural: string;
  icon: string;
  blockKind: BlockKind;
  sortOrder: number;
}

export function parseCategoryInput(
  fd: FormData,
  mode: 'create' | 'update',
  validIcons: readonly string[],
): ParseResult<CategoryFormInput> {
  const errors: Errors = {};

  const slug = mode === 'create' ? requireSlug(fd, 'slug', 64, errors) : undefined;
  const label = requireStr(fd, 'label', 'La etiqueta', 120, errors);
  const labelPlural = requireStr(fd, 'labelPlural', 'La etiqueta plural', 120, errors);
  const icon = requireEnum(fd, 'icon', 'un ícono', validIcons, errors);
  const blockKind = requireEnum(fd, 'blockKind', 'un tipo de bloque', BLOCK_KINDS, errors);
  const sortOrder = requireInt(fd, 'sortOrder', 'El orden', 0, errors);

  if (Object.keys(errors).length > 0 || !icon || !blockKind || sortOrder === undefined) {
    return { ok: false, errors };
  }
  return { ok: true, data: { ...(slug !== undefined ? { slug } : {}), label, labelPlural, icon, blockKind, sortOrder } };
}

// ---------------------------------------------------------------------------
// cities (ciudades)
// ---------------------------------------------------------------------------

export interface CityFormInput {
  slug?: string; // create only
  label: string;
  sortOrder: number;
  lat: number | null;
  lng: number | null;
}

export function parseCityInput(fd: FormData, mode: 'create' | 'update'): ParseResult<CityFormInput> {
  const errors: Errors = {};

  const slug = mode === 'create' ? requireSlug(fd, 'slug', 64, errors) : undefined;
  const label = requireStr(fd, 'label', 'La etiqueta', 120, errors);
  const sortOrder = requireInt(fd, 'sortOrder', 'El orden', 0, errors);
  const { lat, lng } = parseCoordinates(fd, errors);

  if (Object.keys(errors).length > 0 || sortOrder === undefined) return { ok: false, errors };
  return { ok: true, data: { ...(slug !== undefined ? { slug } : {}), label, sortOrder, lat, lng } };
}

// ---------------------------------------------------------------------------
// hours (BUILD-SPEC-PR5 §1) — a section of the listing edit form, not its own
// route. Seven days × up to three ranges, as flat text inputs:
//   hours_<day>_<slot>_open / hours_<day>_<slot>_close   day 0..6, slot 0..2
// ---------------------------------------------------------------------------

const DAY_LABELS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HOURS_SLOTS_PER_DAY = 3;

interface ParsedRange {
  open: string;
  close: string;
  openMinute: number;
  closeMinute: number;
}

/** `close <= open` means the range crosses midnight — its effective close for overlap math is `close + 1440`. */
function effectiveClose(r: Pick<ParsedRange, 'openMinute' | 'closeMinute'>): number {
  return r.closeMinute <= r.openMinute ? r.closeMinute + 1440 : r.closeMinute;
}

function rangesOverlap(a: ParsedRange, b: ParsedRange): boolean {
  return a.openMinute < effectiveClose(b) && b.openMinute < effectiveClose(a);
}

/**
 * Pure: no clock, no DB. Both blank means the slot does not exist (that is how
 * a day is marked closed — every slot blank); one blank and the other filled
 * is a field error naming the day, never inferred. `close <= open` is VALID —
 * it means the range crosses midnight and is never "fixed" by swapping.
 */
export function parseHoursInput(fd: FormData): ParseResult<DayHours[]> {
  const errors: Errors = {};
  const byDay = new Map<number, ParsedRange[]>();

  for (let day = 0; day <= 6; day++) {
    const dayLabel = DAY_LABELS_ES[day];
    const ranges: ParsedRange[] = [];

    for (let slot = 0; slot < HOURS_SLOTS_PER_DAY; slot++) {
      const openKey = `hours_${day}_${slot}_open`;
      const closeKey = `hours_${day}_${slot}_close`;
      const openRaw = value(fd, openKey);
      const closeRaw = value(fd, closeKey);

      if (!openRaw && !closeRaw) continue; // the slot does not exist

      if (!openRaw || !closeRaw) {
        errors[!openRaw ? openKey : closeKey] = 'Completá la hora de apertura y la de cierre.';
        continue;
      }
      if (!TIME_PATTERN.test(openRaw)) {
        errors[openKey] = `Hora inválida (${dayLabel}). Usá el formato HH:MM.`;
        continue;
      }
      if (!TIME_PATTERN.test(closeRaw)) {
        errors[closeKey] = `Hora inválida (${dayLabel}). Usá el formato HH:MM.`;
        continue;
      }
      if (openRaw === closeRaw) {
        errors[closeKey] = 'Un turno no puede abrir y cerrar a la misma hora.';
        continue;
      }

      const openMinute = toMinutes(openRaw);
      const closeMinute = toMinutes(closeRaw);

      if (ranges.some((r) => r.openMinute === openMinute)) {
        errors[openKey] = `Ya hay un turno del ${dayLabel} que empieza a esa hora.`;
        continue;
      }

      ranges.push({ open: openRaw, close: closeRaw, openMinute, closeMinute });
    }

    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        if (rangesOverlap(ranges[i]!, ranges[j]!)) {
          errors[`hours_${day}_${j}_open`] = `Los turnos del ${dayLabel} se superponen.`;
        }
      }
    }

    if (ranges.length > 0) byDay.set(day, ranges);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const data: DayHours[] = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, ranges]) => ({
      day: day as DayHours['day'],
      ranges: [...ranges]
        .sort((a, b) => a.openMinute - b.openMinute)
        .map((r) => ({ open: r.open, close: r.close })),
    }));

  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// premiumUntil / verified (BUILD-SPEC-PR5 §3) — admin only
// ---------------------------------------------------------------------------

/** Paraguay is UTC-3 year round (no DST since 2024) — see README → Database. */
const ASUNCION_UTC_OFFSET_HOURS = 3;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM-DD` → unix seconds at 23:59:59 `America/Asuncion` on that date —
 * end of day, so "premium until the 31st" means the whole 31st. A UTC
 * round-trip would drift the date by one day for Asunción (UTC−3).
 */
export function parsePremiumUntilDate(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = DATE_PATTERN.exec(trimmed);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as unknown as [string, number, number, number];
  const localAsUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59);
  if (Number.isNaN(localAsUtcMs)) return null;
  // Reject an out-of-range calendar date (e.g. 2026-02-30) rather than
  // silently rolling it into March.
  const check = new Date(localAsUtcMs);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return Math.floor(localAsUtcMs / 1000) + ASUNCION_UTC_OFFSET_HOURS * 3600;
}

/** Inverse of `parsePremiumUntilDate`, for rendering the stored value back into the form. */
export function formatPremiumUntilDate(seconds: number): string {
  const localMs = seconds * 1000 - ASUNCION_UTC_OFFSET_HOURS * 3600 * 1000;
  return new Date(localMs).toISOString().slice(0, 10);
}

/**
 * Two parsers, not one (ROADMAP W2-2). `verified` is a human assertion and
 * `premiumUntil` is a sale; they are submitted by two different forms and
 * written by two different query-module functions, so a combined parser would
 * be the one place they were still coupled — and would happily carry an absent
 * checkbox from the premium form through as `verified: false`.
 *
 * That is the actual bug the split removes: an unchecked HTML checkbox sends
 * nothing at all, so any form that did not render the checkbox silently
 * un-verified the business on save.
 */
export function parseListingVerifiedInput(fd: FormData): ParseResult<{ verified: boolean }> {
  const verified = value(fd, 'verified') === 'on' || fd.get('verified') === 'true';
  return { ok: true, data: { verified } };
}

export function parsePremiumUntilInput(fd: FormData): ParseResult<{ premiumUntil: number | null }> {
  const rawDate = value(fd, 'premiumUntil');
  if (!rawDate) return { ok: true, data: { premiumUntil: null } };

  const premiumUntil = parsePremiumUntilDate(rawDate);
  if (premiumUntil === null) {
    return { ok: false, errors: { premiumUntil: 'Escribí una fecha válida (AAAA-MM-DD).' } };
  }
  return { ok: true, data: { premiumUntil } };
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export interface UserFormInput {
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
}

/**
 * `mode: 'create'` omits status — a new account is always active; suspending is
 * an edit. The role options are the staff pair only: the owner roles exist in
 * the enum for PR-6 and must not be assignable from this form.
 */
export function parseUserInput(fd: FormData, mode: 'create' | 'update'): ParseResult<UserFormInput> {
  const errors: Errors = {};

  const email = requireEmail(fd, 'email', errors);
  const name = requireStr(fd, 'name', 'El nombre', 120, errors);
  const role = requireEnum(fd, 'role', 'un rol', STAFF_ROLES, errors);
  const status = mode === 'create' ? 'active' : requireEnum(fd, 'status', 'un estado', USER_STATUSES, errors);

  if (Object.keys(errors).length > 0 || !role || !status) return { ok: false, errors };
  return { ok: true, data: { email, name, role, status } };
}

// ---------------------------------------------------------------------------
// login / password change
// ---------------------------------------------------------------------------

export interface LoginFormInput {
  email: string;
  password: string;
}

/**
 * Never reports WHICH field is wrong beyond "it is empty": the login page has
 * exactly one error message, and a field-level hint here would start to leak
 * which half of the credential was recognised.
 */
export function parseLoginInput(fd: FormData): ParseResult<LoginFormInput> {
  const email = value(fd, 'email').toLowerCase();
  const password = typeof fd.get('password') === 'string' ? String(fd.get('password')) : '';
  if (!email || !password || password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, errors: {} };
  }
  return { ok: true, data: { email, password } };
}

export interface PasswordChangeInput {
  current: string;
  next: string;
}

export function parsePasswordChangeInput(fd: FormData): ParseResult<PasswordChangeInput> {
  const errors: Errors = {};
  const current = typeof fd.get('current') === 'string' ? String(fd.get('current')) : '';
  const next = typeof fd.get('next') === 'string' ? String(fd.get('next')) : '';
  const repeat = typeof fd.get('repeat') === 'string' ? String(fd.get('repeat')) : '';

  if (!current) errors['current'] = 'Escribí tu contraseña actual.';
  if (next.length < MIN_PASSWORD_LENGTH) {
    errors['next'] = `Usá al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  } else if (next.length > MAX_PASSWORD_LENGTH) {
    errors['next'] = 'Esa contraseña es demasiado larga.';
  } else if (next === current) {
    errors['next'] = 'La contraseña nueva tiene que ser distinta de la actual.';
  }
  if (next !== repeat) errors['repeat'] = 'Las contraseñas no coinciden.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { current, next } };
}

export interface ResetRequestInput {
  email: string;
}

/**
 * The "send me a link" form. Like `parseLoginInput`, it reports nothing
 * field-specific: the page has one message for every outcome, because a
 * different one for "that is not an email" versus "no such account" is the
 * beginning of an account-enumeration oracle.
 */
export function parseResetRequestInput(fd: FormData): ParseResult<ResetRequestInput> {
  const email = value(fd, 'email').toLowerCase();
  if (!email || email.length > 160 || !email.includes('@')) return { ok: false, errors: {} };
  return { ok: true, data: { email } };
}

export interface ResetPasswordInput {
  token: string;
  next: string;
}

/**
 * The "choose a new password" form. This one DOES report per-field errors —
 * whoever is looking at it already proved possession of the token, so there is
 * nothing left to leak, and "the passwords do not match" has to be sayable.
 */
export function parseResetPasswordInput(fd: FormData): ParseResult<ResetPasswordInput> {
  const errors: Errors = {};
  const token = value(fd, 'token');
  const next = typeof fd.get('next') === 'string' ? String(fd.get('next')) : '';
  const repeat = typeof fd.get('repeat') === 'string' ? String(fd.get('repeat')) : '';

  if (next.length < MIN_PASSWORD_LENGTH) {
    errors['next'] = `Usá al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  } else if (next.length > MAX_PASSWORD_LENGTH) {
    errors['next'] = 'Esa contraseña es demasiado larga.';
  }
  if (next !== repeat) errors['repeat'] = 'Las contraseñas no coinciden.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // A missing token is not a field error — the form never renders without one,
  // so its absence means a tampered submission, not a mistake worth explaining.
  if (!token) return { ok: false, errors: {} };
  return { ok: true, data: { token, next } };
}

// ---------------------------------------------------------------------------
// shared list-page parsing
// ---------------------------------------------------------------------------

/** Search and pagination from `searchParams`. Out-of-range values fall back to page 1. */
export function parseListParams(params: Record<string, string | string[] | undefined>): {
  q: string;
  page: number;
} {
  const rawQ = params['q'];
  const rawPage = params['page'];
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ)?.trim() ?? '';
  const pageNum = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
  return { q: q.slice(0, 120), page };
}

function oneOf(params: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const raw = params[name];
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return v || undefined;
}

const LISTING_ESTADOS = ['por-vencer', 'vencido', 'sin-actualizar', 'sin-contacto'] as const;

/** `listListings` search params: `q` + `page`, the two taxonomy filters, and the staleness-dashboard `estado` link. */
export function parseListingListParams(params: Record<string, string | string[] | undefined>): {
  q: string;
  page: number;
  categoria?: string;
  ciudad?: string;
  estado?: (typeof LISTING_ESTADOS)[number];
  /** Lifecycle filter (ROADMAP W2-1). Absent = every status. */
  status?: ListingStatus;
} {
  const base = parseListParams(params);
  const rawEstado = oneOf(params, 'estado');
  const estado = (LISTING_ESTADOS as readonly string[]).includes(rawEstado ?? '')
    ? (rawEstado as (typeof LISTING_ESTADOS)[number])
    : undefined;
  const rawStatus = oneOf(params, 'status');
  const status = (LISTING_STATUSES as readonly string[]).includes(rawStatus ?? '')
    ? (rawStatus as ListingStatus)
    : undefined;
  return {
    ...base,
    categoria: oneOf(params, 'categoria'),
    ciudad: oneOf(params, 'ciudad'),
    estado,
    status,
  };
}

/**
 * `listReviews` search params: `page` plus the moderation-status filter.
 * Defaults to `pending` — the queue's whole purpose is what is waiting, so an
 * unfiltered link would open on a wall of already-decided reviews.
 */
export function parseReviewListParams(params: Record<string, string | string[] | undefined>): {
  page: number;
  status: ReviewStatus;
} {
  const { page } = parseListParams(params);
  const raw = oneOf(params, 'estado');
  const status = (REVIEW_STATUSES as readonly string[]).includes(raw ?? '') ? (raw as ReviewStatus) : 'pending';
  return { page, status };
}

/** `listLeads` search params: `q` + `page` plus the source filter. */
export function parseLeadListParams(params: Record<string, string | string[] | undefined>): {
  q: string;
  page: number;
  source?: string;
} {
  const base = parseListParams(params);
  return { ...base, source: oneOf(params, 'source') };
}

/**
 * The amount and method that accompany a package sale (ROADMAP W2-3 / D5).
 *
 * Pure, like everything else in this module, and deliberately strict:
 *
 *  - The amount is parsed from a string that may carry the thousands
 *    separators a Paraguayan actually types — `65.000`, `65 000`, `Gs. 65.000`.
 *    Rejecting those would mean the person retypes the number until the form
 *    stops complaining, which is how ₲65 gets recorded instead of ₲65.000.
 *  - There is NO decimal handling, on purpose. The guaraní has no subunit, so
 *    a "65.000,50" is a typo, not a price, and a dot is a thousands separator
 *    every time.
 *  - Zero is allowed but must be typed. A giveaway is a real event; an empty
 *    field is a skipped question.
 */
export interface SaleFormInput {
  amountGs: number;
  method: SaleMethod;
}

export type SaleParse = { ok: true; data: SaleFormInput } | { ok: false; message: string };

export function parseSaleInput(fd: FormData): SaleParse {
  const rawAmount = value(fd, 'amountGs');
  if (!rawAmount) return { ok: false, message: 'Escribí el monto de la venta en guaraníes.' };

  // Strip everything that is not a digit: "Gs. 65.000" and "65 000" are the
  // same number, and both are how this gets typed in practice.
  const digits = rawAmount.replace(/[^\d]/g, '');
  if (!digits || !/^\d+$/.test(digits)) {
    return { ok: false, message: 'El monto tiene que ser un número en guaraníes, sin centavos.' };
  }

  const amountGs = Number(digits);
  if (!Number.isSafeInteger(amountGs)) {
    return { ok: false, message: 'Ese monto es demasiado grande.' };
  }

  const rawMethod = value(fd, 'method');
  if (!(SALE_METHODS as readonly string[]).includes(rawMethod)) {
    return { ok: false, message: 'Elegí un medio de pago.' };
  }

  return { ok: true, data: { amountGs, method: rawMethod as SaleMethod } };
}
