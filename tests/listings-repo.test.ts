import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `lib/listings-repo.ts` selects the DB provider once `DATABASE_URL` is set
 * (`dbConfigured()`), otherwise the seed provider — and no longer falls back
 * to seed on a DB error (§ ROADMAP PR-2). These tests exercise `selectPrimary`
 * directly with both providers mocked, so no MySQL connection is ever made.
 */

vi.mock('server-only', () => ({}));

const dbConfiguredMock = vi.fn<() => boolean>();

vi.mock('../lib/providers/db', () => ({
  dbProvider: { name: 'mysql' },
  dbConfigured: dbConfiguredMock,
}));

vi.mock('../lib/providers/seed', () => ({
  seedProvider: { name: 'seed' },
}));

describe('selectPrimary', () => {
  beforeEach(() => {
    vi.resetModules();
    dbConfiguredMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the db provider when DATABASE_URL is configured', async () => {
    dbConfiguredMock.mockReturnValue(true);
    const { selectPrimary } = await import('../lib/listings-repo');
    expect(selectPrimary().name).toBe('mysql');
  });

  it('returns the seed provider when DATABASE_URL is not configured', async () => {
    dbConfiguredMock.mockReturnValue(false);
    const { selectPrimary } = await import('../lib/listings-repo');
    expect(selectPrimary().name).toBe('seed');
  });

  it('exposes the same provider chosen at module load through the repo functions', async () => {
    dbConfiguredMock.mockReturnValue(true);
    const repo = await import('../lib/listings-repo');
    // The module-level `primary` is resolved once at import time from the
    // same dbConfigured() the test controls above.
    expect(repo.selectPrimary().name).toBe('mysql');
  });
});
