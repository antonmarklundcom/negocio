import 'server-only';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { getDb } from './client';
import type { Db } from './connection';
import { logActivity } from './activity-log';
import { passwordResetTokens, users, type UserStatus } from './schema';

/**
 * All password-reset SQL.
 *
 * **Deliberately unguarded**, for the same reason `findAccountForLogin` is: the
 * caller is by definition signed out — someone who could pass `requireRole`
 * would not be here. The authorization that matters is possession of a token
 * from an email nobody else can read, and that check lives in
 * `consumeResetToken` below, inside the transaction that spends it.
 *
 * Every function takes `database: Db = getDb()` last so tests can inject a fake
 * and assert that a rejected call wrote nothing.
 */

/** The columns the request step needs. No credential, no personal detail. */
export interface ResetRecipient {
  id: number;
  email: string;
  name: string;
  status: UserStatus;
}

/**
 * Look up who a reset request is for.
 *
 * Returns suspended accounts too, rather than filtering them out in SQL: the
 * caller has to spend the same wall time whether or not it ends up sending, and
 * having the status in hand is what lets it decide silently.
 */
export async function findResetRecipient(
  email: string,
  database: Db = getDb(),
): Promise<ResetRecipient | null> {
  const [row] = await database
    .select({ id: users.id, email: users.email, name: users.name, status: users.status })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

/**
 * Store a freshly minted token, after invalidating this account's outstanding
 * ones.
 *
 * Invalidating first is what stops a mailbox full of working links: ask five
 * times and only the fifth email opens a door. Done in one transaction so there
 * is no instant where an account has zero usable tokens but the email promising
 * one has already been queued.
 */
export async function createResetToken(
  userId: number,
  tokenHash: string,
  expiresAt: Date,
  database: Db = getDb(),
): Promise<void> {
  const now = new Date();
  await database.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  });
}

export interface StoredResetToken {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  /** Carried along so the reset page can greet the person by name. */
  email: string;
  name: string;
  status: UserStatus;
}

/** Find a token by its hash, with the account it belongs to. */
export async function findResetToken(
  tokenHash: string,
  database: Db = getDb(),
): Promise<StoredResetToken | null> {
  const [row] = await database
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      tokenHash: passwordResetTokens.tokenHash,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
      email: users.email,
      name: users.name,
      status: users.status,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  return row ?? null;
}

export class ResetTokenSpentError extends Error {
  constructor() {
    super('Ese enlace ya no sirve.');
    this.name = 'ResetTokenSpentError';
  }
}

/**
 * Spend a token and set the new password, or throw.
 *
 * THE WHOLE SECURITY OF THIS FLOW IS IN THIS TRANSACTION, in four parts:
 *
 * 1. **The token is marked used with `used_at IS NULL` in the WHERE clause**,
 *    and the update's affected-row count is what authorises the rest. Checking
 *    "is it still unused?" with a SELECT first and updating after would leave a
 *    window in which two requests carrying the same link both pass the check —
 *    two people setting two different passwords, the second silently winning.
 *    Here the database decides, once.
 * 2. **`passwordChangedAt` is stamped**, which revokes every session the
 *    account has open (ROADMAP W1-2). Someone resetting a password is often
 *    doing it *because* somebody else is holding a cookie.
 * 3. **`mustChangePassword` is cleared**: the person just chose this password
 *    themselves, so forcing them to choose again at the next screen would be
 *    theatre.
 * 4. **Every other outstanding token for the account is spent too.** Two reset
 *    emails in a mailbox must not mean two chances.
 *
 * The activity log records the fact and nothing else — no token, no hash, no
 * password — with a null actor, because the person who did this was not signed
 * in when they did it.
 */
export async function consumeResetToken(
  tokenId: number,
  userId: number,
  newHash: string,
  database: Db = getDb(),
): Promise<void> {
  const now = new Date();
  await database.transaction(async (tx) => {
    const spent = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.id, tokenId), isNull(passwordResetTokens.usedAt)));

    if (!affectedOne(spent)) throw new ResetTokenSpentError();

    await tx
      .update(users)
      .set({ passwordHash: newHash, mustChangePassword: false, passwordChangedAt: now })
      .where(eq(users.id, userId));

    // Any sibling token — an earlier email still sitting in the mailbox — dies
    // with it.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

    await logActivity(tx, {
      // Null: this happened without a session. The audit trail says a password
      // was reset by email, not who was holding the keyboard — which is the
      // honest answer, since that is exactly what the flow cannot know.
      userId: null,
      entityType: 'user',
      entityId: String(userId),
      action: 'update',
      before: { passwordResetByEmail: false },
      after: { passwordResetByEmail: true },
    });
  });
}

/**
 * Housekeeping: forget tokens that are long dead.
 *
 * Not wired to a schedule — it is called opportunistically by the request path,
 * which is the only place that already pays for a write. A spent token is
 * audit trail for a while and rubbish after that.
 */
export async function purgeExpiredResetTokens(
  before: Date,
  database: Db = getDb(),
): Promise<void> {
  await database
    .delete(passwordResetTokens)
    .where(or(lt(passwordResetTokens.expiresAt, before), lt(passwordResetTokens.usedAt, before)));
}

/**
 * Drizzle's MySQL update result shape varies by driver version, so the
 * affected-row count is read defensively rather than by index into a tuple.
 * Getting this wrong in the optimistic direction would turn the single-use
 * guarantee off silently, so an unrecognised shape counts as "did not update".
 */
function affectedOne(result: unknown): boolean {
  const header = Array.isArray(result) ? result[0] : result;
  if (!header || typeof header !== 'object') return false;
  const rows = (header as { affectedRows?: unknown }).affectedRows;
  return typeof rows === 'number' && rows > 0;
}
