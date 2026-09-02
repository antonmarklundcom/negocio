import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientIp, rateLimit } from '@/lib/rate-limit';

/**
 * `lib/rate-limit.ts` is an in-memory fixed-window limiter (ROADMAP F10 /
 * D9). Each test uses a fresh, unique key so buckets from other tests in this
 * file never collide — the module holds one shared `Map` for the whole
 * process.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimit', () => {
  it('allows the first call for a fresh key', () => {
    const result = rateLimit('fresh-key', { limit: 3, windowMs: 1000 });
    expect(result).toEqual({ ok: true, retryAfter: 0 });
  });

  it('allows up to the limit, then denies with a positive retryAfter', () => {
    const key = 'limit-key';
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit(key, opts).ok).toBe(true);
    expect(rateLimit(key, opts).ok).toBe(true);
    expect(rateLimit(key, opts).ok).toBe(true);
    const denied = rateLimit(key, opts);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfter).toBeGreaterThan(0);
  });

  it('resets the bucket once the window elapses', () => {
    const key = 'reset-key';
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit(key, opts).ok).toBe(true);
    expect(rateLimit(key, opts).ok).toBe(false);

    vi.advanceTimersByTime(1000);

    expect(rateLimit(key, opts).ok).toBe(true);
  });

  it('tracks separate keys independently', () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit('key-a', opts).ok).toBe(true);
    // key-a is now exhausted, but key-b has never been called.
    expect(rateLimit('key-a', opts).ok).toBe(false);
    expect(rateLimit('key-b', opts).ok).toBe(true);
  });
});

describe('clientIp', () => {
  function requestWithHeaders(headers: Record<string, string>): Request {
    return new Request('http://localhost/api/test', { headers: new Headers(headers) });
  }

  it('reads the first IP from a comma-separated x-forwarded-for header', () => {
    const request = requestWithHeaders({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(clientIp(request)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const request = requestWithHeaders({ 'x-real-ip': '198.51.100.7' });
    expect(clientIp(request)).toBe('198.51.100.7');
  });

  it("falls back to 'unknown' when neither header is present", () => {
    const request = requestWithHeaders({});
    expect(clientIp(request)).toBe('unknown');
  });
});
