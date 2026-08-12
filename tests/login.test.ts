import { beforeEach, describe, expect, it } from 'vitest';
import { authenticate, normalizeEmail, resetDecoyHash, LOGIN_ERROR, type LoginAccount } from '@/lib/auth/login';
import { hashPassword, type ScryptParams } from '@/lib/auth/password';

/** Reduced cost so the suite stays fast; the decision logic is parameter-agnostic. */
const CHEAP: ScryptParams = { N: 2 ** 10, r: 8, p: 1 };
const WEAKER: ScryptParams = { N: 2 ** 8, r: 8, p: 1 };

const PASSWORD = 'una-contrasena-larga';

async function account(overrides: Partial<LoginAccount> = {}): Promise<LoginAccount> {
  return {
    id: 7,
    email: 'staff@negocio.com.py',
    passwordHash: await hashPassword(PASSWORD, CHEAP),
    role: 'editor',
    status: 'active',
    mustChangePassword: false,
    ...overrides,
  };
}

beforeEach(() => {
  resetDecoyHash();
});

describe('authenticate', () => {
  it('accepts the right password and returns a minimal session payload', async () => {
    const result = await authenticate(await account(), PASSWORD, { params: CHEAP });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The cookie carries only id, role, scope and the must-change flag — no
    // email, no name, no status. Those are read from the DB at use time so a
    // suspension takes effect on the next request.
    expect(Object.keys(result.user).sort()).toEqual(['id', 'mustChangePassword', 'ownerId', 'role']);
    expect(result.user.id).toBe(7);
    expect(result.user.ownerId).toBeNull();
  });

  it('carries the must-change-password flag into the session', async () => {
    const result = await authenticate(await account({ mustChangePassword: true }), PASSWORD, { params: CHEAP });
    expect(result.ok && result.user.mustChangePassword).toBe(true);
  });

  it.each([
    ['unknown email', null, PASSWORD, 'unknown_email'],
    ['no password set', { passwordHash: null }, PASSWORD, 'no_password_set'],
    ['wrong password', {}, 'incorrecta-pero-larga', 'wrong_password'],
    ['suspended', { status: 'suspended' as const }, PASSWORD, 'suspended'],
  ])('fails for %s and never says which', async (_label, overrides, password, reason) => {
    const acct = overrides === null ? null : await account(overrides);
    const result = await authenticate(acct, password, { params: CHEAP });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(reason);
  });

  it('rejects empty and over-long input before doing any work', async () => {
    const acct = await account();
    expect(await authenticate(acct, '', { params: CHEAP })).toEqual({ ok: false, reason: 'invalid_input' });
    expect(await authenticate(acct, 'x'.repeat(2000), { params: CHEAP })).toEqual({
      ok: false,
      reason: 'invalid_input',
    });
  });

  /**
   * "Suspended" is checked AFTER the password on purpose. A suspended account
   * with a WRONG password must be indistinguishable from an active one with a
   * wrong password — including in how long it takes.
   */
  it('reports a suspended account with a wrong password as a wrong password', async () => {
    const result = await authenticate(
      await account({ status: 'suspended' }),
      'incorrecta-pero-larga',
      { params: CHEAP },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('wrong_password');
  });

  it('upgrades a hash stored with weaker parameters, on a successful login only', async () => {
    const weak = await account({ passwordHash: await hashPassword(PASSWORD, WEAKER) });

    const success = await authenticate(weak, PASSWORD, { params: CHEAP });
    expect(success.ok && typeof success.rehashTo).toBe('string');

    const failure = await authenticate(weak, 'incorrecta-pero-larga', { params: CHEAP });
    expect(failure.ok).toBe(false);
  });

  it('does not re-hash a password already at the current parameters', async () => {
    const result = await authenticate(await account(), PASSWORD, { params: CHEAP });
    expect(result.ok && result.rehashTo).toBeUndefined();
  });

  it('exposes exactly one error string for the UI to render', () => {
    expect(LOGIN_ERROR).toBe('Correo o contraseña incorrectos.');
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases so lookup matches storage', () => {
    expect(normalizeEmail('  Staff@Negocio.COM.py ')).toBe('staff@negocio.com.py');
  });
});
