import type { UserRole, UserStatus } from '@/lib/db/schema';
import type { SessionUser } from './session';

/**
 * The "is this cookie still valid" decision, PURE (ROADMAP W1-2).
 *
 * Split out of `session.ts` for the same reason `lib/admin/validation.ts` is
 * split out of the actions: this is the part with the security judgement in
 * it, and it must be testable without a cookie, a database or a clock.
 *
 * The rule is simple and the ORDER matters: a cookie that opens cleanly is
 * still refused when the account is gone, is suspended, or when the password
 * changed after the cookie was issued.
 */

export interface SessionAccountFacts {
  id: number;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
}

export type SessionRejection = 'no_account' | 'suspended' | 'password_changed';

export type SessionCheck =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: SessionRejection };

export function checkSession(
  claims: SessionUser,
  account: SessionAccountFacts | null,
): SessionCheck {
  if (!account) return { ok: false, reason: 'no_account' };
  if (account.status !== 'active') return { ok: false, reason: 'suspended' };

  if (account.passwordChangedAt) {
    const changedAt = Math.floor(account.passwordChangedAt.getTime() / 1000);
    // A cookie with no `issuedAt` predates W1-2 and is treated as issued at 0,
    // so any recorded password change revokes it. Failing OPEN on a missing
    // issue time while failing CLOSED on the comparison is the safe pairing.
    if ((claims.issuedAt ?? 0) < changedAt) return { ok: false, reason: 'password_changed' };
  }

  return {
    ok: true,
    user: {
      id: account.id,
      // From the ROW, not the cookie: a demotion must not wait eight hours for
      // the cookie to expire, and it must apply to server actions as well as
      // pages — Next does not re-run the /admin layout for an action.
      role: account.role,
      ownerId: claims.ownerId,
      mustChangePassword: account.mustChangePassword,
      issuedAt: claims.issuedAt,
    },
  };
}
