import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/auth/password';
import { STAFF_ROLES, USER_STATUSES, type UserRole, type UserStatus } from '@/lib/db/schema';

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
