import { describe, expect, it } from 'vitest';
import { checkSession, type SessionAccountFacts } from '@/lib/auth/session-check';
import type { SessionUser } from '@/lib/auth/session';

/**
 * ROADMAP W1-2. Pure, so this runs with no cookie, no database and no clock.
 *
 * What is being asserted here is that a cookie which OPENS CLEANLY can still
 * be refused. Before W1-2 it could not: the sealed payload was the whole
 * answer, so suspending an account or demoting an admin took effect whenever
 * that person's cookie happened to expire — up to eight hours later — while
 * the README and the ROADMAP both claimed the opposite.
 */

const ISSUED = 1_760_000_000;

function claims(over: Partial<SessionUser> = {}): SessionUser {
  return { id: 7, role: 'admin', ownerId: null, mustChangePassword: false, issuedAt: ISSUED, ...over };
}

function account(over: Partial<SessionAccountFacts> = {}): SessionAccountFacts {
  return { id: 7, role: 'admin', status: 'active', mustChangePassword: false, passwordChangedAt: null, ...over };
}

describe('checkSession', () => {
  it('accepts a live account', () => {
    const result = checkSession(claims(), account());
    expect(result.ok).toBe(true);
  });

  it('refuses a deleted account', () => {
    expect(checkSession(claims(), null)).toEqual({ ok: false, reason: 'no_account' });
  });

  it('refuses a suspended account, however fresh the cookie', () => {
    // The S1 finding: this used to keep working for the cookie's full 8-hour
    // TTL, which is exactly the window in which somebody is suspended.
    expect(checkSession(claims(), account({ status: 'suspended' }))).toEqual({
      ok: false,
      reason: 'suspended',
    });
  });

  it('takes the role from the ROW, not from the cookie', () => {
    // A demoted admin whose cookie still says "admin" must be an editor on the
    // very next request — including inside a server action, which never
    // re-runs the /admin layout.
    const result = checkSession(claims({ role: 'admin' }), account({ role: 'editor' }));
    expect(result.ok && result.user.role).toBe('editor');
  });

  it('takes mustChangePassword from the ROW too', () => {
    // An admin-issued reset must force the change on the next request, not
    // whenever the person next signs in.
    const result = checkSession(claims({ mustChangePassword: false }), account({ mustChangePassword: true }));
    expect(result.ok && result.user.mustChangePassword).toBe(true);
  });

  it('refuses a cookie issued before the password changed', () => {
    // The S2 finding, and the whole reason a person changes their password
    // under duress: the stolen laptop is still holding a valid cookie.
    const changed = new Date((ISSUED + 60) * 1000);
    expect(checkSession(claims(), account({ passwordChangedAt: changed }))).toEqual({
      ok: false,
      reason: 'password_changed',
    });
  });

  it('accepts a cookie issued after the password changed', () => {
    // The tab that performed the change re-issues its own cookie, so it is the
    // one session that survives.
    const changed = new Date((ISSUED - 60) * 1000);
    expect(checkSession(claims(), account({ passwordChangedAt: changed })).ok).toBe(true);
  });

  it('accepts a cookie issued in the same second as the change', () => {
    // Strictly-older is refused; same-second is the re-issue itself.
    const changed = new Date(ISSUED * 1000);
    expect(checkSession(claims(), account({ passwordChangedAt: changed })).ok).toBe(true);
  });

  it('refuses a cookie with no issuedAt once a password change is recorded', () => {
    // Cookies minted before W1-2 shipped carry no issue time. They keep
    // working — until the password changes, which must revoke them.
    const changed = new Date(ISSUED * 1000);
    const legacy = claims();
    delete legacy.issuedAt;
    expect(checkSession(legacy, account({ passwordChangedAt: changed }))).toEqual({
      ok: false,
      reason: 'password_changed',
    });
  });

  it('accepts a cookie with no issuedAt while no password change is recorded', () => {
    const legacy = claims();
    delete legacy.issuedAt;
    expect(checkSession(legacy, account()).ok).toBe(true);
  });

  it('checks the account before the password timestamp', () => {
    // A suspended account whose password also changed must report the
    // suspension: the reason goes to the log, and "suspended" is the one an
    // operator needs to see.
    const changed = new Date((ISSUED + 60) * 1000);
    expect(checkSession(claims(), account({ status: 'suspended', passwordChangedAt: changed }))).toEqual({
      ok: false,
      reason: 'suspended',
    });
  });
});
