import { describe, expect, it } from 'vitest';
import { AuthError, hasRole, isAuthError, requireRole } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { UserRole } from '@/lib/db/schema';

function session(role: UserRole): SessionUser {
  return { id: 1, role, ownerId: null, mustChangePassword: false };
}

describe('hasRole', () => {
  it('grants an admin both staff roles', () => {
    expect(hasRole(session('admin'), ['admin'])).toBe(true);
    expect(hasRole(session('admin'), ['editor'])).toBe(true);
  });

  it('does not promote an editor to admin', () => {
    expect(hasRole(session('editor'), ['editor'])).toBe(true);
    expect(hasRole(session('editor'), ['admin'])).toBe(false);
  });

  /**
   * The reason roles are a satisfaction map and not a numeric ladder: with
   * levels, `owner_admin >= editor` would be true and an owner would reach a
   * staff screen. These must ALL be false.
   */
  it('gives the owner roles no staff standing at all', () => {
    for (const role of ['owner_admin', 'owner_editor'] as const) {
      expect(hasRole(session(role), ['admin'])).toBe(false);
      expect(hasRole(session(role), ['editor'])).toBe(false);
      expect(hasRole(session(role), ['admin', 'editor'])).toBe(false);
    }
  });

  it('ranks the owner roles only against each other', () => {
    expect(hasRole(session('owner_admin'), ['owner_editor'])).toBe(true);
    expect(hasRole(session('owner_editor'), ['owner_admin'])).toBe(false);
  });

  it('never grants anything to an anonymous request', () => {
    expect(hasRole(null, ['admin'])).toBe(false);
    expect(hasRole(null, ['editor'])).toBe(false);
    expect(hasRole(null, ['owner_editor'])).toBe(false);
  });

  it('grants nothing when the allowed list is empty', () => {
    expect(hasRole(session('admin'), [])).toBe(false);
  });
});

describe('requireRole', () => {
  it('returns the session user on success', () => {
    const user = session('admin');
    expect(requireRole(user, ['editor'])).toBe(user);
  });

  it('distinguishes unauthenticated from forbidden — for the LOG, not the response', () => {
    try {
      requireRole(null, ['editor']);
      expect.unreachable('requireRole must throw for an anonymous request');
    } catch (err) {
      expect(isAuthError(err)).toBe(true);
      expect((err as AuthError).reason).toBe('unauthenticated');
    }

    try {
      requireRole(session('editor'), ['admin']);
      expect.unreachable('requireRole must throw when the role does not satisfy');
    } catch (err) {
      expect(isAuthError(err)).toBe(true);
      expect((err as AuthError).reason).toBe('forbidden');
    }
  });
});
