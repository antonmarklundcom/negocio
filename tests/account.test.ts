import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveFreshSession, type AccountState } from '@/lib/auth/account-rules';
import type { SessionUser } from '@/lib/auth/session';

/**
 * The session cookie is minimal SO THAT a revocation takes effect on the next
 * request. These tests are what prove it actually does — without them,
 * "suspended" and "demoted" are decorative for the eight hours a cookie lives.
 */

const COOKIE: SessionUser = { id: 4, role: 'admin', ownerId: null, mustChangePassword: false };

function account(overrides: Partial<AccountState> = {}): AccountState {
  return { role: 'admin', status: 'active', mustChangePassword: false, ...overrides };
}

describe('resolveFreshSession', () => {
  it('passes an active account through', () => {
    expect(resolveFreshSession(COOKIE, account())).toEqual(COOKIE);
  });

  it('drops a suspended account, however valid its cookie', () => {
    expect(resolveFreshSession(COOKIE, account({ status: 'suspended' }))).toBeNull();
  });

  it('drops an account deleted between requests', () => {
    expect(resolveFreshSession(COOKIE, null)).toBeNull();
  });

  it('has nothing to resolve without a cookie', () => {
    expect(resolveFreshSession(null, account())).toBeNull();
  });

  /**
   * The role comes from the DATABASE, never from the cookie. A cookie minted
   * while the account was an admin must not still act as one after a demotion —
   * which is the whole reason the cookie is minimal in the first place.
   */
  it('takes the demoted role from the database, not the stale cookie', () => {
    const resolved = resolveFreshSession(COOKIE, account({ role: 'editor' }));
    expect(resolved?.role).toBe('editor');
  });

  it('takes a promotion from the database too', () => {
    const editorCookie: SessionUser = { ...COOKIE, role: 'editor' };
    expect(resolveFreshSession(editorCookie, account({ role: 'admin' }))?.role).toBe('admin');
  });

  /**
   * An admin-issued password reset sets the flag; picking it up here is what
   * bounces a still-signed-in session into the forced-change screen instead of
   * letting it keep working on a credential that was just revoked.
   */
  it('picks up a must-change-password flag set after the cookie was issued', () => {
    const resolved = resolveFreshSession(COOKIE, account({ mustChangePassword: true }));
    expect(resolved?.mustChangePassword).toBe(true);
  });

  it('keeps the id and scope from the cookie — the session is still that session', () => {
    const resolved = resolveFreshSession(COOKIE, account({ role: 'editor' }));
    expect(resolved?.id).toBe(4);
    expect(resolved?.ownerId).toBeNull();
  });

  it('returns only the four session fields, never a database row', () => {
    const resolved = resolveFreshSession(COOKIE, account());
    expect(Object.keys(resolved ?? {}).sort()).toEqual(['id', 'mustChangePassword', 'ownerId', 'role']);
  });
});
