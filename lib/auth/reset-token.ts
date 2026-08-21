import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Password-reset tokens: minting, hashing and the decision about whether one is
 * still good. Pure — no database, no clock of its own, no session — so every
 * rule below is unit-testable without MySQL, exactly like `password.ts`.
 *
 * The token a person receives is 32 bytes of `randomBytes`, base64url. What the
 * database stores is its SHA-256 (see `schema.ts` for why a fast hash is the
 * right choice for a random secret and the wrong one for a chosen password).
 */

/** 32 bytes ≈ 256 bits. Guessing one is not a threat model, it is arithmetic. */
const TOKEN_BYTES = 32;

/**
 * An hour. Long enough to walk away from the keyboard and come back, short
 * enough that a link sitting in a mailbox — or in a mail server's logs, or on
 * the screen of a shared machine — stops working the same morning.
 */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface MintedResetToken {
  /** Goes in the email. Never stored, never logged. */
  token: string;
  /** Goes in the database. */
  tokenHash: string;
}

export function mintResetToken(): MintedResetToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashResetToken(token) };
}

/** SHA-256, hex. The same function is used to store and to look up. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two token hashes.
 *
 * The lookup itself is by indexed equality, so this is belt-and-braces rather
 * than the primary defence — but the hashes are compared somewhere, and a
 * `===` on a secret-derived value is the kind of thing that is free to get
 * right now and awkward to notice later.
 */
export function resetTokenHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** What a stored token row has to look like for the decision below. */
export interface ResetTokenRecord {
  expiresAt: Date;
  usedAt: Date | null;
}

export type ResetTokenState = 'valid' | 'expired' | 'used' | 'unknown';

/**
 * Whether a token may still be spent.
 *
 * `used` is checked before `expired` only so the server log is precise; the
 * caller must treat all three failures identically in what it shows, because
 * "this token was already used" tells whoever is holding a stolen link that
 * they are holding a real one.
 */
export function resetTokenState(record: ResetTokenRecord | null, now: Date): ResetTokenState {
  if (!record) return 'unknown';
  if (record.usedAt) return 'used';
  if (record.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

/** The absolute expiry for a token minted at `now`. */
export function resetTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MS);
}

/**
 * The link that goes in the email.
 *
 * The token rides in the query string, which means it is also in the browser's
 * history and in any `Referer` the reset page emits. That is the standard
 * shape and is acceptable here for one reason: spending the token immediately
 * invalidates it, so a copy recovered from history is a copy of something that
 * no longer works.
 */
export function resetLink(siteUrl: string, token: string): string {
  return `${siteUrl}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
}

/**
 * The ONE message for every unusable token — expired, already spent, never
 * existed, belongs to a suspended account.
 *
 * It lives here rather than in the action because a `'use server'` module may
 * only export async functions, and because both the page and the action have
 * to say exactly the same thing: a page that distinguished "already used" from
 * "never existed" would undo the care taken everywhere else.
 */
export const INVALID_RESET_TOKEN =
  'Ese enlace no sirve o ya venció. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".';
