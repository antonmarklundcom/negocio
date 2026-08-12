import 'server-only';
import { and, asc, eq, like, ne, or, sql } from 'drizzle-orm';
import { getDb } from './client';
import type { Db } from './connection';
import { requireRole, AuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { logActivity } from './activity-log';
import { users, type UserRole, type UserStatus } from './schema';

/**
 * All user SQL. THIS MODULE IS THE AUTHORIZATION BOUNDARY: every exported
 * function calls `requireRole` as its first statement, before touching the
 * database. The `/admin` layout guard is a backstop only — a server action is
 * directly reachable over HTTP and Next.js does not re-run the layout for it.
 *
 * Every function takes `database: Db = getDb()` as its last parameter so tests
 * can inject a fake and assert that a rejected call wrote nothing.
 *
 * Snapshots written to `activity_log` go through `auditView`, which drops
 * `passwordHash` — a credential must never reach the audit trail.
 */

export interface AdminUserRow {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  hasPassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

const ADMIN_USER_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  status: users.status,
  mustChangePassword: users.mustChangePassword,
  hasPassword: sql<boolean>`${users.passwordHash} is not null`,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
} as const;

/** The audit-safe projection of a user. Never includes the password hash. */
function auditView(row: Pick<AdminUserRow, 'email' | 'name' | 'role' | 'status'>): Record<string, unknown> {
  return { email: row.email, name: row.name, role: row.role, status: row.status };
}

// ---------------------------------------------------------------------------
// Unguarded — the login path only. NOT exported to the admin.
// ---------------------------------------------------------------------------

/**
 * Look up an account for authentication. Deliberately has no `requireRole`:
 * the caller is by definition unauthenticated. It is exported for
 * `app/(auth)/ingresar` and the password-change flow, returns the hash, and
 * must never be called from a page that renders a user list.
 */
export async function findAccountForLogin(email: string, database: Db = getDb()) {
  const [row] = await database
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
      role: users.role,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

export async function findAccountById(id: number, database: Db = getDb()) {
  const [row] = await database
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
      role: users.role,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

/** Records a successful sign-in. Not an admin action, so not audit-logged. */
export async function markLoggedIn(id: number, hash?: string, database: Db = getDb()): Promise<void> {
  await database
    .update(users)
    .set({ lastLoginAt: new Date(), ...(hash ? { passwordHash: hash } : {}) })
    .where(eq(users.id, id));
}

// ---------------------------------------------------------------------------
// Guarded. Every function below calls requireRole as its first statement.
// ---------------------------------------------------------------------------

/**
 * Clears the forced-password-change flag and stores the new hash. Called by the
 * `/cambiar-contrasena` flow AFTER it has re-verified the current password.
 *
 * The id written is taken from the SESSION, never from an argument — so this
 * function has no way to touch anyone else's row even if a caller passes one.
 */
export async function changeOwnPassword(
  actor: SessionUser | null,
  newHash: string,
  database: Db = getDb(),
): Promise<void> {
  // Any signed-in role may change their OWN password — including the owner
  // roles reserved for PR-6, which is why this lists all four rather than
  // using the staff pair.
  const user = requireRole(actor, ['admin', 'editor', 'owner_admin', 'owner_editor']);
  const id = user.id;

  await database.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: newHash, mustChangePassword: false })
      .where(eq(users.id, id));
    await logActivity(tx, {
      userId: id,
      entityType: 'user',
      entityId: String(id),
      action: 'update',
      // Both snapshots are deliberately empty: the FACT of a password change is
      // the audit record. Nothing about the credential belongs in the log.
      before: {},
      after: {},
    });
  });
}

// --- admin-only from here ---

export interface UserListResult {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const USERS_PAGE_SIZE = 25;

export async function listUsers(
  actor: SessionUser | null,
  params: { q?: string; page?: number } = {},
  database: Db = getDb(),
): Promise<UserListResult> {
  requireRole(actor, ['admin']);

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const q = params.q?.trim() ?? '';
  const where = q
    ? or(like(users.name, `%${q}%`), like(users.email, `%${q}%`))
    : undefined;

  const rows = await database
    .select(ADMIN_USER_COLUMNS)
    .from(users)
    .where(where)
    .orderBy(asc(users.name))
    .limit(USERS_PAGE_SIZE)
    .offset((page - 1) * USERS_PAGE_SIZE);

  const [counted] = await database
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .where(where);

  return { rows, total: Number(counted?.total ?? 0), page, pageSize: USERS_PAGE_SIZE };
}

export async function getUser(
  actor: SessionUser | null,
  id: number,
  database: Db = getDb(),
): Promise<AdminUserRow | null> {
  requireRole(actor, ['admin']);
  const [row] = await database.select(ADMIN_USER_COLUMNS).from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function isEmailTaken(
  actor: SessionUser | null,
  email: string,
  exceptId: number | null,
  database: Db = getDb(),
): Promise<boolean> {
  requireRole(actor, ['admin']);
  const where = exceptId === null ? eq(users.email, email) : and(eq(users.email, email), ne(users.id, exceptId));
  const [row] = await database.select({ id: users.id }).from(users).where(where).limit(1);
  return !!row;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Creates an account with NO password. The admin then issues a reset, which is
 * what prints a one-time credential — so no code path anywhere invents a
 * default password.
 */
export async function createUser(
  actor: SessionUser | null,
  input: CreateUserInput,
  database: Db = getDb(),
): Promise<number> {
  const admin = requireRole(actor, ['admin']);
  assertAssignableRole(input.role);

  return database.transaction(async (tx) => {
    const [res] = await tx.insert(users).values({
      email: input.email,
      name: input.name,
      role: input.role,
      status: 'active',
      mustChangePassword: true,
    });
    const id = res.insertId;
    await logActivity(tx, {
      userId: admin.id,
      entityType: 'user',
      entityId: String(id),
      action: 'create',
      after: auditView({ ...input, status: 'active' }),
    });
    return id;
  });
}

export interface UpdateUserInput {
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
}

export async function updateUser(
  actor: SessionUser | null,
  id: number,
  input: UpdateUserInput,
  database: Db = getDb(),
): Promise<void> {
  const admin = requireRole(actor, ['admin']);
  assertAssignableRole(input.role);

  // An admin locking or demoting themselves would leave the panel unreachable
  // and is never what was meant. Suspending a *different* admin is allowed.
  if (id === admin.id && (input.status === 'suspended' || input.role !== 'admin')) {
    throw new AuthError('No podés quitarte tu propio acceso de administrador.', 'forbidden');
  }

  await database.transaction(async (tx) => {
    const [before] = await tx
      .select({ email: users.email, name: users.name, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!before) throw new AuthError('No encontramos ese usuario.', 'forbidden');

    await tx
      .update(users)
      .set({ email: input.email, name: input.name, role: input.role, status: input.status })
      .where(eq(users.id, id));

    await logActivity(tx, {
      userId: admin.id,
      entityType: 'user',
      entityId: String(id),
      action: 'update',
      before: auditView(before),
      after: auditView(input),
    });
  });
}

/**
 * Issues a new random password and forces a change on next sign-in. Returns the
 * plaintext exactly once, for the admin to hand over — it is never stored and
 * never logged.
 */
export async function resetUserPassword(
  actor: SessionUser | null,
  id: number,
  plaintext: string,
  database: Db = getDb(),
): Promise<void> {
  const admin = requireRole(actor, ['admin']);
  const hash = await hashPassword(plaintext);

  await database.transaction(async (tx) => {
    const [before] = await tx.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!before) throw new AuthError('No encontramos ese usuario.', 'forbidden');

    await tx.update(users).set({ passwordHash: hash, mustChangePassword: true }).where(eq(users.id, id));
    await logActivity(tx, {
      userId: admin.id,
      entityType: 'user',
      entityId: String(id),
      action: 'update',
      // The fact, never the credential.
      before: { passwordReset: false },
      after: { passwordReset: true },
    });
  });
}

/** The roles a staff screen may assign today. The owner roles are PR-6's. */
const ASSIGNABLE_ROLES: readonly UserRole[] = ['admin', 'editor'];

function assertAssignableRole(role: UserRole): void {
  if (!ASSIGNABLE_ROLES.includes(role)) {
    // Asserted here as well as in validation, because the form is not the only
    // caller of this module.
    throw new AuthError('Ese rol todavía no se puede asignar.', 'forbidden');
  }
}

/**
 * Unguarded on purpose, like `findAccountForLogin`: its only caller is
 * `scripts/bootstrap-admin.ts`, which runs in a shell with no session and needs
 * this to REFUSE to mint a second admin. It leaks nothing but a boolean.
 */
export async function hasOtherActiveAdmin(exceptId: number | null, database: Db = getDb()): Promise<boolean> {
  const conditions = [eq(users.role, 'admin'), eq(users.status, 'active')];
  if (exceptId !== null) conditions.push(ne(users.id, exceptId));
  const [row] = await database
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}
