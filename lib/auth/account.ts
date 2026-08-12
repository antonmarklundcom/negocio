import 'server-only';
import { cache } from 'react';
import { dbConfigured } from '@/lib/db/client';
import { findAccountById } from '@/lib/db/users';
import { currentUser, type SessionUser } from './session';
import { resolveFreshSession } from './account-rules';

export { resolveFreshSession, type AccountState } from './account-rules';

/**
 * The session every admin page and action should use.
 *
 * A cookie says who the request CLAIMS to be; the database says what they may
 * CURRENTLY do. Without this re-read, suspending or demoting an account would
 * be decorative for up to eight hours — the whole lifetime of a session — and
 * the minimal cookie payload would buy nothing.
 *
 * Wrapped in React's `cache` so a layout and the page it renders share ONE
 * lookup per request. The rule itself lives in `account-rules.ts`, pure and
 * unit-tested; this function is only the I/O around it.
 *
 * `currentUser()` (cookie only) stays available for the paths that must not
 * touch the database — the login action's own session issuing, and the session
 * helpers themselves.
 */
export const currentAccount = cache(async (): Promise<SessionUser | null> => {
  const cookieUser = await currentUser();
  if (!cookieUser) return null;
  if (!dbConfigured()) return null;

  try {
    const account = await findAccountById(cookieUser.id);
    return resolveFreshSession(cookieUser, account);
  } catch (err) {
    // A database outage must not silently grant access on a stale cookie.
    console.error('[auth] could not refresh the session from the database:', err);
    return null;
  }
});
