import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  hashResetToken,
  mintResetToken,
  resetLink,
  resetTokenExpiry,
  resetTokenHashEquals,
  resetTokenState,
  RESET_TOKEN_TTL_MS,
} from '@/lib/auth/reset-token';
import { resetEmail } from '@/lib/auth/reset-email';
import { parseResetPasswordInput, parseResetRequestInput } from '@/lib/admin/validation';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';

const NOW = new Date('2026-08-21T12:00:00Z');

describe('mintResetToken', () => {
  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => mintResetToken().token));
    expect(tokens.size).toBe(50);
  });

  it('returns the hash of the token it returns, and not the token itself', () => {
    const { token, tokenHash } = mintResetToken();
    expect(tokenHash).toBe(hashResetToken(token));
    // What is stored must not be reversible by simply reading it: the hash is
    // hex and shares no substring with the base64url token.
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toContain(token);
  });

  it('mints a URL-safe token — it travels in a query string', () => {
    for (let i = 0; i < 20; i++) {
      const { token } = mintResetToken();
      expect(token).toBe(encodeURIComponent(token));
    }
  });
});

describe('resetTokenHashEquals', () => {
  it('compares equal and unequal hashes correctly, including different lengths', () => {
    const a = hashResetToken('one');
    expect(resetTokenHashEquals(a, hashResetToken('one'))).toBe(true);
    expect(resetTokenHashEquals(a, hashResetToken('two'))).toBe(false);
    expect(resetTokenHashEquals(a, 'short')).toBe(false);
    expect(resetTokenHashEquals(a, '')).toBe(false);
  });
});

/**
 * The single-use and expiry rules. These are the whole reason a reset link is
 * safe to put in an email, so they are asserted directly rather than only
 * through the action.
 */
describe('resetTokenState', () => {
  const future = new Date(NOW.getTime() + 60_000);
  const past = new Date(NOW.getTime() - 60_000);

  it('is valid only when unused and unexpired', () => {
    expect(resetTokenState({ expiresAt: future, usedAt: null }, NOW)).toBe('valid');
  });

  it('is used once spent, even if it has not expired', () => {
    expect(resetTokenState({ expiresAt: future, usedAt: past }, NOW)).toBe('used');
  });

  it('is expired once past its expiry', () => {
    expect(resetTokenState({ expiresAt: past, usedAt: null }, NOW)).toBe('expired');
  });

  it('treats the expiry instant itself as expired, not valid', () => {
    // `<=`, not `<`: a token whose expiry is exactly now has run out.
    expect(resetTokenState({ expiresAt: NOW, usedAt: null }, NOW)).toBe('expired');
  });

  it('is unknown for a token that does not exist', () => {
    expect(resetTokenState(null, NOW)).toBe('unknown');
  });
});

describe('resetTokenExpiry', () => {
  it('is an hour out — long enough to step away, short enough to matter', () => {
    expect(resetTokenExpiry(NOW).getTime() - NOW.getTime()).toBe(RESET_TOKEN_TTL_MS);
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });
});

describe('resetLink', () => {
  it('points at the reset page with the token escaped', () => {
    expect(resetLink('https://negocio.com.py', 'abc-123')).toBe(
      'https://negocio.com.py/restablecer-contrasena?token=abc-123',
    );
  });

  it('escapes a token containing URL metacharacters', () => {
    expect(resetLink('https://negocio.com.py', 'a&b=c')).toContain('token=a%26b%3Dc');
  });
});

describe('resetEmail', () => {
  it('carries the link in the plain-text body, readable before clicking', () => {
    const { subject, text } = resetEmail({ name: 'Ana', link: 'https://negocio.com.py/x' });
    expect(subject).toContain('contraseña');
    expect(text).toContain('Ana');
    expect(text).toContain('https://negocio.com.py/x');
    // Says both things a reset mail has to say: it expires, and ignoring it is safe.
    expect(text).toContain('60 minutos');
    expect(text).toMatch(/no pediste/i);
  });
});

describe('parseResetRequestInput', () => {
  it('accepts and lowercases an address', () => {
    const fd = new FormData();
    fd.set('email', '  Ana@Example.COM ');
    const parsed = parseResetRequestInput(fd);
    expect(parsed).toEqual({ ok: true, data: { email: 'ana@example.com' } });
  });

  it('rejects junk WITHOUT naming a field — the page has one message', () => {
    for (const bad of ['', 'not-an-email', 'x'.repeat(200)]) {
      const fd = new FormData();
      fd.set('email', bad);
      const parsed = parseResetRequestInput(fd);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors).toEqual({});
    }
  });
});

describe('parseResetPasswordInput', () => {
  function form(next: string, repeat: string, token = 'tok') {
    const fd = new FormData();
    fd.set('token', token);
    fd.set('next', next);
    fd.set('repeat', repeat);
    return fd;
  }

  it('accepts a long-enough matching pair', () => {
    const parsed = parseResetPasswordInput(form('correcthorsebattery', 'correcthorsebattery'));
    expect(parsed).toEqual({ ok: true, data: { token: 'tok', next: 'correcthorsebattery' } });
  });

  it('enforces the shared minimum length', () => {
    const parsed = parseResetPasswordInput(form('short', 'short'));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors['next']).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('reports a mismatch — the person already proved possession, so this is sayable', () => {
    const parsed = parseResetPasswordInput(form('correcthorsebattery', 'correcthorsebatteryX'));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors['repeat']).toBeTruthy();
  });

  it('rejects a missing token with no field error — that is tampering, not a typo', () => {
    const parsed = parseResetPasswordInput(form('correcthorsebattery', 'correcthorsebattery', ''));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toEqual({});
  });
});
