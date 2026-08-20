import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import type { UserRole } from '@/lib/db/schema';
import { checkSession } from './session-check';

/**
 * The session cookie. This file exists to enforce one rule: NOTHING the client
 * sends is trusted except the sealed cookie. No `x-user-role` header, no role in
 * a query string, no client component reporting who it thinks it is.
 *
 * The payload is deliberately minimal — id, role, scope, must-change flag,
 * and the instant it was issued. Everything that decides what the holder may
 * DO is re-read from the database at use time by `currentUser()`, so
 * suspending or demoting an account takes effect on the NEXT REQUEST rather
 * than whenever a stale cookie happens to expire (ROADMAP W1-2).
 */

export interface SessionUser {
  id: number;
  role: UserRole;
  /** The business this session is scoped to. Always null until PR-6 (owner portal). */
  ownerId: number | null;
  mustChangePassword: boolean;
  /**
   * Unix seconds at which this cookie was issued (ROADMAP W1-2). Compared
   * against `users.password_changed_at` so a password change revokes every
   * session that predates it — including the one on the stolen laptop, which
   * is the entire point of changing a password under duress.
   *
   * Optional so a cookie issued before this shipped still opens; it is then
   * treated as issued at 0, i.e. before any password change, i.e. revoked the
   * moment the password is next changed. Failing open on the ISSUE time while
   * failing closed on the COMPARISON is the safe combination.
   */
  issuedAt?: number;
}

interface SessionData {
  user?: SessionUser;
}

/** A working day, not a month. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export const SESSION_COOKIE_NAME = 'negocio_session';

export class MissingSessionSecretError extends Error {
  constructor() {
    super(
      'SESSION_SECRET is not set, or is shorter than 32 characters. ' +
        'Generate one with `openssl rand -base64 32` and add it to the app env ' +
        '(Hostinger: hPanel → Node.js app → Environment variables), then redeploy.',
    );
    this.name = 'MissingSessionSecretError';
  }
}

/**
 * Fails loudly rather than falling back to a development default. A default
 * secret is a forgeable session cookie, and it would inevitably reach
 * production the first time someone forgot the env var.
 */
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new MissingSessionSecretError();
  return secret;
}

/** True when a usable secret is configured. Never throws. */
export function sessionConfigured(): boolean {
  const secret = process.env.SESSION_SECRET;
  return !!secret && secret.length >= 32;
}

export function sessionOptions(): SessionOptions {
  return {
    password: sessionSecret(),
    cookieName: SESSION_COOKIE_NAME,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      // Off in development only — there is no TLS locally to be secure over.
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  // Next.js 15 made `cookies()` async; iron-session 8.0.4 predates that and
  // still expects the resolved cookie store, not a `Promise` — the fix is to
  // await it here, not the codemod's `UnsafeUnwrappedCookies` escape hatch.
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}

/**
 * What the COOKIE claims, with nothing verified against the database.
 *
 * Only two callers should ever want this: the login flow (which is issuing the
 * cookie) and `currentUser()` below (which is about to check it). Everything
 * else must use `currentUser()`, or a suspended account keeps working for the
 * cookie's remaining eight hours.
 *
 * NEVER throws: a malformed, forged or expired cookie is an anonymous request,
 * not a crash. A missing SESSION_SECRET is also anonymous here — the loud
 * failure belongs on the login path, not on every page that happens to check.
 */
export async function sessionClaims(): Promise<SessionUser | null> {
  try {
    const session = await getSession();
    return session.user ?? null;
  } catch {
    return null;
  }
}

/**
 * The current user, RE-READ FROM THE DATABASE (ROADMAP W1-2).
 *
 * Before this, the cookie was the whole answer: suspending an account or
 * demoting an admin to editor took effect whenever their cookie happened to
 * expire, up to eight hours later, while the README and ROADMAP both claimed
 * otherwise. Now every request checks the row.
 *
 * Four ways this returns null for a cookie that opens cleanly:
 *   - the account was deleted
 *   - the account is suspended
 *   - the account's password changed after this cookie was issued
 *   - the database cannot be reached
 *
 * The last one is deliberate and is a real trade: a database blip signs staff
 * out rather than serving the admin from an unverified cookie. The public site
 * does not call this at all, so a blip cannot take the site down — and "fail
 * closed" is the only defensible default for the thing that decides who may
 * write.
 *
 * `role` comes back from the ROW, not from the cookie, so a demotion applies
 * immediately and to server actions as well as to pages — which is where rule
 * 1 lives ("`requireRole` is the first statement of every query-module
 * function"), and a server action never re-runs the `/admin` layout.
 *
 * Wrapped in React's `cache()` so the several `currentUser()` calls a single
 * admin render makes collapse into one query per request.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const claims = await sessionClaims();
  if (!claims) return null;

  // Imported lazily: this module is pulled in by `(auth)` pages that must
  // render with no database configured at all, and a top-level import of the
  // db client would make `dbConfigured()` irrelevant.
  const { findSessionAccount } = await import('@/lib/db/users');

  let account;
  try {
    account = await findSessionAccount(claims.id);
  } catch (err) {
    console.error('[auth] could not verify the session against the database:', err);
    return null;
  }

  const check = checkSession(claims, account);
  if (!check.ok) {
    console.info(`[auth] session refused for user ${claims.id}: ${check.reason}`);
    return null;
  }
  return check.user;
});

/**
 * Issue a cookie. `issuedAt` is stamped HERE and never taken from the caller,
 * so no code path can mint a session that back-dates itself past a password
 * change.
 */
export async function startSession(user: SessionUser): Promise<void> {
  const session = await getSession();
  session.user = { ...user, issuedAt: Math.floor(Date.now() / 1000) };
  await session.save();
}

export async function destroySession(): Promise<void> {
  try {
    const session = await getSession();
    session.destroy();
  } catch {
    // A cookie we cannot open is already unusable; logging out is still a success.
  }
}
