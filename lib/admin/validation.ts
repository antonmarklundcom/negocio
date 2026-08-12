import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/auth/password';
import { BLOCK_KINDS, STAFF_ROLES, USER_STATUSES, type BlockKind, type UserRole, type UserStatus } from '@/lib/db/schema';
import { parseLines, parsePipedLines, type LineError } from './blocks';

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

  if (Object.keys(errors).length > 0 || !categoria || !ciudad) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      ...(slug !== undefined ? { slug } : {}),
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

/** `listListings` search params: `q` + `page` plus the two taxonomy filters. */
export function parseListingListParams(params: Record<string, string | string[] | undefined>): {
  q: string;
  page: number;
  categoria?: string;
  ciudad?: string;
} {
  const base = parseListParams(params);
  return { ...base, categoria: oneOf(params, 'categoria'), ciudad: oneOf(params, 'ciudad') };
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
