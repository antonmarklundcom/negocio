import 'server-only';
import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import type { UserRole } from '@/lib/db/schema';

/**
 * The session cookie. This file exists to enforce one rule: NOTHING the client
 * sends is trusted except the sealed cookie. No `x-user-role` header, no role in
 * a query string, no client component reporting who it thinks it is.
 *
 * The payload is deliberately minimal — id, role, scope, must-change flag.
 * Name, email and status are read from the database at use time, so suspending
 * or demoting an account takes effect on the NEXT REQUEST rather than whenever
 * a stale cookie happens to expire.
 */

export interface SessionUser {
  id: number;
  role: UserRole;
  /** The business this session is scoped to. Always null until PR-6 (owner portal). */
  ownerId: number | null;
  mustChangePassword: boolean;
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
 * The current session user, or null. NEVER throws: a malformed, forged or
 * expired cookie is an anonymous request, not a crash. A missing SESSION_SECRET
 * is also anonymous here — the loud failure belongs on the login path, not on
 * every public page that happens to check.
 */
export async function currentUser(): Promise<SessionUser | null> {
  try {
    const session = await getSession();
    return session.user ?? null;
  } catch {
    return null;
  }
}

export async function startSession(user: SessionUser): Promise<void> {
  const session = await getSession();
  session.user = user;
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
