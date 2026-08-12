import type { UserRole } from '@/lib/db/schema';
import type { SessionUser } from './session';

/**
 * The two functions the whole admin builds against. Both are PURE over a
 * `SessionUser`, which is what makes every negative case testable without a
 * browser, a cookie or a database.
 *
 * Roles are an explicit "what does this role satisfy" map, NOT a numeric
 * ladder. `admin > editor > owner_admin > owner_editor` is not an ordering: an
 * `owner_admin` outranks an `owner_editor` *inside their own business* and has
 * no standing at all outside it. A numeric level invites
 * `level >= OWNER_ADMIN` checks, which is exactly how an owner ends up on a
 * staff screen.
 *
 * The owner roles exist in the database enum (reserved for PR-6) but satisfy
 * nothing staff-facing here, so an owner account created later cannot reach
 * `/admin` even before the portal is written.
 */

const SATISFIES: Record<UserRole, readonly UserRole[]> = {
  admin: ['admin', 'editor'],
  editor: ['editor'],
  owner_admin: ['owner_admin', 'owner_editor'],
  owner_editor: ['owner_editor'],
};

export type AuthErrorReason = 'unauthenticated' | 'forbidden';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly reason: AuthErrorReason,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function isAuthError(err: unknown): err is AuthError {
  return err instanceof AuthError;
}

export function hasRole(user: SessionUser | null, allowed: readonly UserRole[]): boolean {
  if (!user) return false;
  const satisfied = SATISFIES[user.role];
  return allowed.some((role) => satisfied.includes(role));
}

/**
 * Throws rather than returning a boolean, on purpose: a caller that forgets to
 * check a returned `false` still ships and is silently unguarded; a caller that
 * forgets to await this does not get past review.
 *
 * This is called as the FIRST STATEMENT of every exported function in
 * `lib/db/users.ts` and every admin query module that follows. The `/admin`
 * layout guard is a backstop only — a server action is directly reachable and
 * Next.js does not re-run the layout for it.
 */
export function requireRole(user: SessionUser | null, allowed: readonly UserRole[]): SessionUser {
  if (!user) throw new AuthError('No hay sesión iniciada.', 'unauthenticated');
  if (!hasRole(user, allowed)) throw new AuthError('No tenés permiso para hacer esto.', 'forbidden');
  return user;
}

/** Human-readable labels for the roles a staff screen may assign. */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  owner_admin: 'Dueño (admin)',
  owner_editor: 'Dueño (editor)',
};
