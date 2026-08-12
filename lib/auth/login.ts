import type { UserRole, UserStatus } from '@/lib/db/schema';
import type { SessionUser } from './session';
import {
  hashPassword,
  needsRehash,
  verifyPassword,
  MAX_PASSWORD_LENGTH,
  type ScryptParams,
} from './password';

/**
 * The sign-in decision, split out of the route so it can be tested without a
 * request, a cookie or a form. The route's only job is to call this and set a
 * cookie.
 *
 * Two rules drive the shape of this file:
 *
 *  1. EVERY failure returns the identical message. Unknown email, wrong
 *     password, no password set, suspended — one string. `reason` exists for
 *     the server log only and must never reach a response body.
 *  2. Every failure path costs roughly the same wall time. An unknown email
 *     hashes against a decoy, and "suspended" is checked AFTER the password —
 *     otherwise response time is a user-enumeration oracle.
 */

export const LOGIN_ERROR = 'Correo o contraseña incorrectos.';

/** The columns the decision needs. Deliberately not the whole row. */
export interface LoginAccount {
  id: number;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
}

export type LoginFailureReason =
  | 'invalid_input'
  | 'unknown_email'
  | 'no_password_set'
  | 'wrong_password'
  | 'suspended';

export type LoginResult =
  | { ok: true; user: SessionUser; rehashTo?: string }
  | { ok: false; reason: LoginFailureReason };

/**
 * The decoy hash, built once on first use and cached.
 *
 * Lazily rather than at module load: hashing at the OWASP cost takes hundreds of
 * milliseconds, and paying it during every cold start — for a path most requests
 * never take — would slow the whole app down.
 */
let decoyPromise: Promise<string> | undefined;

export function decoyHash(params?: ScryptParams): Promise<string> {
  if (!decoyPromise) {
    decoyPromise = hashPassword('decoy-account-with-no-real-password', params);
  }
  return decoyPromise;
}

/** Test seam: forget the cached decoy so a test can supply cheap parameters. */
export function resetDecoyHash(): void {
  decoyPromise = undefined;
}

export async function authenticate(
  account: LoginAccount | null,
  password: string,
  options: { params?: ScryptParams } = {},
): Promise<LoginResult> {
  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: 'invalid_input' };
  }

  // Both of these hash against a decoy so that "no such account" and "account
  // with no credential" cost the same as a real wrong-password attempt.
  if (!account) {
    await verifyPassword(password, await decoyHash(options.params));
    return { ok: false, reason: 'unknown_email' };
  }
  if (!account.passwordHash) {
    await verifyPassword(password, await decoyHash(options.params));
    return { ok: false, reason: 'no_password_set' };
  }

  const correct = await verifyPassword(password, account.passwordHash);
  if (!correct) return { ok: false, reason: 'wrong_password' };

  // AFTER the password check, so a suspended account is not distinguishable by
  // response time from an active one with a wrong password.
  if (account.status === 'suspended') return { ok: false, reason: 'suspended' };

  const rehashTo = needsRehash(account.passwordHash, options.params)
    ? await hashPassword(password, options.params)
    : undefined;

  return {
    ok: true,
    user: {
      id: account.id,
      role: account.role,
      ownerId: null, // staff sessions are unscoped; owner scoping arrives in PR-6
      mustChangePassword: account.mustChangePassword,
    },
    ...(rehashTo ? { rehashTo } : {}),
  };
}

/** Normalise a submitted email the same way everywhere it is stored or looked up. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
