import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing with scrypt from `node:crypto`.
 *
 * NOT bcrypt, deliberately: bcrypt is a native module compiled against the Node
 * ABI at install time, so on Hostinger's managed Node a platform upgrade turns
 * every login into a 500 until someone SSHs in and rebuilds. scrypt is standard
 * library, memory-hard and has no build step.
 *
 * The stored string is self-describing — `scrypt$N$r$p$salt$key` — so the
 * parameters can be raised later without invalidating existing hashes:
 * `verifyPassword` reads N/r/p back OUT of the stored string rather than
 * assuming today's constants, and `needsRehash` tells the login path when a
 * stored hash was made with weaker settings so it can be upgraded transparently.
 *
 * This module is pure (no database, no session, no clock) and therefore fully
 * unit-testable without MySQL.
 */

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** OWASP floor for scrypt. Raise N here and existing hashes upgrade on next login. */
export const SCRYPT_PARAMS: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };

/**
 * Node's default maxmem is 32 MB — BELOW the ~134 MB that N=2^17, r=8 needs.
 * Left at the default, scrypt throws rather than silently weakening, but the
 * error surfaces as a failed login. Set it explicitly and generously.
 */
const MAX_MEM = 256 * 1024 * 1024;

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export const MIN_PASSWORD_LENGTH = 12;
/** Unbounded input reaches an unauthenticated endpoint; scrypt cost is per-byte. */
export const MAX_PASSWORD_LENGTH = 1024;

export interface ParsedHash extends ScryptParams {
  salt: Buffer;
  key: Buffer;
}

/** `scrypt$N$r$p$<salt b64>$<key b64>`, or null when the string is not one of ours. */
export function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 6) return null;
  const [scheme, nRaw, rRaw, pRaw, saltRaw, keyRaw] = parts;
  if (scheme !== 'scrypt' || !nRaw || !rRaw || !pRaw || !saltRaw || !keyRaw) return null;

  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!isPositiveInt(N) || !isPositiveInt(r) || !isPositiveInt(p)) return null;
  // N must be a power of two or scrypt itself rejects it.
  if ((N & (N - 1)) !== 0) return null;

  try {
    const salt = Buffer.from(saltRaw, 'base64');
    const key = Buffer.from(keyRaw, 'base64');
    if (salt.length === 0 || key.length === 0) return null;
    return { N, r, p, salt, key };
  } catch {
    return null;
  }
}

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

export class PasswordLengthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordLengthError';
  }
}

function assertLength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordLengthError(`La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new PasswordLengthError('La contraseña es demasiado larga.');
  }
}

/** Hash a new password. `params` is injectable so tests need not pay the OWASP cost. */
export async function hashPassword(password: string, params: ScryptParams = SCRYPT_PARAMS): Promise<string> {
  assertLength(password);
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, KEY_LENGTH, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/**
 * Constant-time verification against a stored hash. Never throws on malformed
 * input — an unparseable hash is simply a failed verification, because the
 * callers (login, password change) must not be able to distinguish
 * "corrupt row" from "wrong password" in their responses.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) return false;
  const parsed = parseHash(stored);
  if (!parsed) return false;
  try {
    const key = await derive(password, parsed.salt, parsed.key.length, parsed);
    return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
  } catch {
    return false;
  }
}

/**
 * True when the stored hash was made with weaker parameters than today's, so
 * the login path can re-hash it while it holds the plaintext. An unparseable
 * hash is not "needs rehash" — it cannot be verified in the first place.
 */
export function needsRehash(stored: string, params: ScryptParams = SCRYPT_PARAMS): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  return parsed.N < params.N || parsed.r < params.r || parsed.p < params.p;
}

/** A URL-safe random password for the bootstrap script and admin-issued resets. */
export function generatePassword(): string {
  return randomBytes(24).toString('base64url');
}

function derive(password: string, salt: Buffer, keylen: number, params: ScryptParams): Promise<Buffer> {
  return scrypt(password, salt, keylen, { N: params.N, r: params.r, p: params.p, maxmem: MAX_MEM });
}
