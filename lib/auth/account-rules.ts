import type { UserRole, UserStatus } from '@/lib/db/schema';
import type { SessionUser } from './session';

/**
 * The revocation rule, kept PURE and in its own module so it can be unit-tested
 * without MySQL, without a cookie, and without Next's RSC runtime (its caller
 * `account.ts` uses React's `cache`, which only exists there).
 *
 * The session cookie is deliberately minimal — id, role, scope, must-change —
 * SO THAT everything else can be re-read from the database at use time and a
 * revocation takes effect on the next request rather than whenever an 8-hour
 * cookie happens to expire. This function is the half that applies what the
 * database said.
 */

/** What the database currently says about the account behind a session. */
export interface AccountState {
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
}

/**
 * Returns the session to act on, or null when the request must be treated as
 * anonymous. The ROLE AND FLAG COME FROM THE DATABASE, never from the cookie: a
 * cookie minted while the account was an admin must not still act as one after
 * a demotion.
 */
export function resolveFreshSession(
  cookieUser: SessionUser | null,
  account: AccountState | null,
): SessionUser | null {
  if (!cookieUser) return null;
  // Deleted between requests, or a forged id: anonymous, not an error.
  if (!account) return null;
  if (account.status === 'suspended') return null;

  return {
    id: cookieUser.id,
    role: account.role,
    ownerId: cookieUser.ownerId,
    mustChangePassword: account.mustChangePassword,
  };
}
