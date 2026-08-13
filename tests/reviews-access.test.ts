import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isAuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import type { Db } from '@/lib/db/connection';
import type { UserRole } from '@/lib/db/schema';
import { approveReview, countPendingReviews, listReviews, rejectReview } from '@/lib/db/reviews-admin';
import { createPendingReview, REVIEW_RATE_LIMIT } from '@/lib/db/reviews';
import { isPublicWriteError } from '@/lib/public-write';
import type { ReviewSubmission } from '@/lib/reviews';

/**
 * The authorization boundary for first-party reviews (ROADMAP Phase D item 5),
 * exercised DIRECTLY against the query modules — same shape as
 * `tests/listings-admin-access.test.ts`.
 *
 * Two boundaries are covered here, because reviews have two write paths:
 *
 *  - `lib/db/reviews-admin.ts` — moderation, guarded by `requireRole`.
 *  - `lib/db/reviews.ts` — the PUBLIC submission, which has no session to
 *    check and is guarded by `requirePublicWrite` (honeypot + per-IP rate
 *    limit) as its first statement instead.
 *
 * CANARY: comment out any `requireRole` line in `lib/db/reviews-admin.ts`, or
 * the `requirePublicWrite` line in `lib/db/reviews.ts`, and re-run this file —
 * the tests for that function must fail. Restore the guard afterwards.
 */

interface Recorder {
  db: Db;
  touched: string[];
}

function recordingDb(): Recorder {
  const touched: string[] = [];
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      const name = String(prop);
      if (name === 'then' || name === 'catch' || name === 'finally') return undefined;
      touched.push(name);
      return () => {
        throw new Error(`the database was reached: .${name}()`);
      };
    },
  };
  return { db: new Proxy({}, handler) as unknown as Db, touched };
}

function session(role: UserRole, id = 1): SessionUser {
  return { id, role, ownerId: null, mustChangePassword: false };
}

const ANONYMOUS = null;
const EDITOR = session('editor', 2);
const ADMIN = session('admin', 1);
const OWNER_ADMIN = session('owner_admin', 3);

const SUBMISSION: ReviewSubmission = {
  listingId: 'listing-1',
  author: 'Vecina de Villa Morra',
  rating: 5,
  body: 'Atendieron rapidísimo y el precio fue el que me pasaron por WhatsApp.',
};

/** A fresh IP per test: the rate limiter is a module-level map shared by the whole file. */
let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

describe('lib/db/reviews-admin — the moderation boundary', () => {
  describe('listReviews', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(listReviews(ANONYMOUS, { status: 'pending' }, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an owner role AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(listReviews(OWNER_ADMIN, { status: 'pending' }, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an editor', async () => {
      const { db, touched } = recordingDb();
      await expect(listReviews(EDITOR, { status: 'pending' }, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });

    it('is reachable by an admin', async () => {
      const { db, touched } = recordingDb();
      await expect(listReviews(ADMIN, { status: 'pending' }, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });
  });

  describe('countPendingReviews', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(countPendingReviews(ANONYMOUS, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an editor', async () => {
      const { db, touched } = recordingDb();
      await expect(countPendingReviews(EDITOR, db)).rejects.toThrow(/the database was reached/);
      expect(touched.length).toBeGreaterThan(0);
    });
  });

  describe('approveReview — the write that makes a stranger’s text public', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(approveReview(ANONYMOUS, 1, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an owner role AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(approveReview(OWNER_ADMIN, 1, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an editor', async () => {
      const { db, touched } = recordingDb();
      await expect(approveReview(EDITOR, 1, db)).rejects.toThrow(/the database was reached/);
      expect(touched).toContain('transaction');
    });

    it('is reachable by an admin', async () => {
      const { db, touched } = recordingDb();
      await expect(approveReview(ADMIN, 1, db)).rejects.toThrow(/the database was reached/);
      expect(touched).toContain('transaction');
    });
  });

  describe('rejectReview', () => {
    it('throws for an anonymous caller AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(rejectReview(ANONYMOUS, 1, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('rejects an owner role AND never reaches the database', async () => {
      const { db, touched } = recordingDb();
      await expect(rejectReview(OWNER_ADMIN, 1, db)).rejects.toSatisfy(isAuthError);
      expect(touched).toEqual([]);
    });

    it('is reachable by an editor', async () => {
      const { db, touched } = recordingDb();
      await expect(rejectReview(EDITOR, 1, db)).rejects.toThrow(/the database was reached/);
      expect(touched).toContain('transaction');
    });
  });
});

describe('lib/db/reviews — the public-write boundary', () => {
  it('drops a honeypot submission AND never reaches the database', async () => {
    const { db, touched } = recordingDb();
    await expect(
      createPendingReview({ ip: freshIp(), honeypot: 'http://spam.example' }, SUBMISSION, db),
    ).rejects.toSatisfy(isPublicWriteError);
    expect(touched).toEqual([]);
  });

  it('rate-limits the same IP AND never reaches the database once the budget is spent', async () => {
    const ip = freshIp();

    // The allowed submissions get past the guard and die at the fake database,
    // which is the proof that the guard let them through.
    for (let i = 0; i < REVIEW_RATE_LIMIT.limit; i++) {
      const { db } = recordingDb();
      await expect(createPendingReview({ ip }, SUBMISSION, db)).rejects.toThrow(/the database was reached/);
    }

    const { db, touched } = recordingDb();
    await expect(createPendingReview({ ip }, SUBMISSION, db)).rejects.toSatisfy(isPublicWriteError);
    expect(touched).toEqual([]);
  });

  it('lets a first submission from a fresh IP through to the database', async () => {
    const { db, touched } = recordingDb();
    await expect(createPendingReview({ ip: freshIp() }, SUBMISSION, db)).rejects.toThrow(
      /the database was reached/,
    );
    expect(touched.length).toBeGreaterThan(0);
  });

  it('a rate-limited caller carries the retry-after the route needs', async () => {
    const ip = freshIp();
    for (let i = 0; i < REVIEW_RATE_LIMIT.limit; i++) {
      const { db } = recordingDb();
      await expect(createPendingReview({ ip }, SUBMISSION, db)).rejects.toThrow(/the database was reached/);
    }
    const { db } = recordingDb();
    await createPendingReview({ ip }, SUBMISSION, db).then(
      () => expect.unreachable('the rate limit should have rejected this'),
      (err: unknown) => {
        if (!isPublicWriteError(err)) throw err;
        expect(err.reason).toBe('rate_limited');
        expect(err.retryAfter).toBeGreaterThan(0);
      },
    );
  });
});
