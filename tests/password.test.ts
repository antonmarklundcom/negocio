import { describe, expect, it } from 'vitest';
import {
  generatePassword,
  hashPassword,
  needsRehash,
  parseHash,
  verifyPassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  PasswordLengthError,
  SCRYPT_PARAMS,
  type ScryptParams,
} from '@/lib/auth/password';

/**
 * These hash at REDUCED parameters so the suite stays fast. The point of every
 * assertion below is that the parameters are read back out of the stored string
 * rather than assumed — which is exactly what makes reducing them here safe.
 */
const CHEAP: ScryptParams = { N: 2 ** 10, r: 8, p: 1 };
const CHEAPER: ScryptParams = { N: 2 ** 8, r: 8, p: 1 };

const PASSWORD = 'una-contrasena-larga-y-secreta';

describe('hashPassword / verifyPassword', () => {
  it('round-trips a correct password', async () => {
    const stored = await hashPassword(PASSWORD, CHEAP);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword(PASSWORD, CHEAP);
    expect(await verifyPassword(PASSWORD + 'x', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const a = await hashPassword(PASSWORD, CHEAP);
    const b = await hashPassword(PASSWORD, CHEAP);
    expect(a).not.toBe(b);
    expect(await verifyPassword(PASSWORD, a)).toBe(true);
    expect(await verifyPassword(PASSWORD, b)).toBe(true);
  });

  it('stores the parameters it used and verifies with THOSE, not with today\'s constants', async () => {
    const stored = await hashPassword(PASSWORD, CHEAPER);
    expect(stored.startsWith(`scrypt$${CHEAPER.N}$${CHEAPER.r}$${CHEAPER.p}$`)).toBe(true);
    // Verifying reads N/r/p out of the string; if it assumed SCRYPT_PARAMS this fails.
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
  });

  it('returns false rather than throwing on a malformed or tampered hash', async () => {
    const stored = await hashPassword(PASSWORD, CHEAP);
    expect(await verifyPassword(PASSWORD, 'not-a-hash')).toBe(false);
    expect(await verifyPassword(PASSWORD, 'scrypt$$$$$')).toBe(false);
    expect(await verifyPassword(PASSWORD, 'bcrypt$1$8$1$aaaa$bbbb')).toBe(false);
    // Flip the last character of the key.
    const tampered = stored.slice(0, -1) + (stored.endsWith('A') ? 'B' : 'A');
    expect(await verifyPassword(PASSWORD, tampered)).toBe(false);
  });

  it('enforces the length bounds when hashing', async () => {
    await expect(hashPassword('x'.repeat(MIN_PASSWORD_LENGTH - 1), CHEAP)).rejects.toBeInstanceOf(
      PasswordLengthError,
    );
    await expect(hashPassword('x'.repeat(MAX_PASSWORD_LENGTH + 1), CHEAP)).rejects.toBeInstanceOf(
      PasswordLengthError,
    );
    await expect(hashPassword('x'.repeat(MIN_PASSWORD_LENGTH), CHEAP)).resolves.toContain('scrypt$');
  });

  it('refuses an over-long password at verify time without hashing it', async () => {
    const stored = await hashPassword(PASSWORD, CHEAP);
    expect(await verifyPassword('x'.repeat(MAX_PASSWORD_LENGTH + 1), stored)).toBe(false);
  });
});

describe('parseHash', () => {
  it('rejects anything that is not our self-describing format', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('scrypt$16384$8$1$salt')).toBeNull(); // too few parts
    expect(parseHash('argon2$16384$8$1$c2FsdA==$a2V5')).toBeNull(); // wrong scheme
    expect(parseHash('scrypt$0$8$1$c2FsdA==$a2V5')).toBeNull(); // N must be positive
    expect(parseHash('scrypt$1000$8$1$c2FsdA==$a2V5')).toBeNull(); // N must be a power of two
    expect(parseHash('scrypt$1024$8$1$$a2V5')).toBeNull(); // empty salt
  });

  it('reads the parameters back out', () => {
    const parsed = parseHash('scrypt$1024$8$1$c2FsdA==$a2V5');
    expect(parsed).not.toBeNull();
    expect(parsed?.N).toBe(1024);
    expect(parsed?.r).toBe(8);
    expect(parsed?.p).toBe(1);
  });
});

describe('needsRehash', () => {
  it('is true for a hash weaker than the current parameters', async () => {
    const stored = await hashPassword(PASSWORD, CHEAP);
    expect(needsRehash(stored, SCRYPT_PARAMS)).toBe(true);
  });

  it('is false at the current parameters', async () => {
    const stored = await hashPassword(PASSWORD, CHEAP);
    expect(needsRehash(stored, CHEAP)).toBe(false);
  });

  it('is false for an unparseable hash — it cannot be verified in the first place', () => {
    expect(needsRehash('garbage', SCRYPT_PARAMS)).toBe(false);
  });
});

describe('generatePassword', () => {
  it('produces a URL-safe secret comfortably above the minimum length', () => {
    const a = generatePassword();
    const b = generatePassword();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
