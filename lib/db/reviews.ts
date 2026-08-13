import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, dbConfigured } from './client';
import type { Db } from './connection';
import { PublicWriteError, requirePublicWrite, type PublicWriteContext } from '@/lib/public-write';
import type { ReviewSubmission } from '@/lib/reviews';
import type { Review } from '../types';
import { listings, reviews } from './schema';

/**
 * The PUBLIC half of first-party reviews (ROADMAP Phase D item 5): one write
 * (a visitor submitting) and one read (approved reviews on a listing page).
 * Moderation lives in `lib/db/reviews-admin.ts`, behind `requireRole`.
 *
 * THIS MODULE IS AN AUTHORIZATION BOUNDARY TOO. There is no session to check
 * on a public form, so `createPendingReview` calls `requirePublicWrite` — the
 * honeypot and the per-IP rate limit — as its FIRST statement, before touching
 * the database, exactly where `requireRole` sits in every admin query module.
 *
 * The row is always inserted as `pending`; the status is not a parameter. A
 * stranger's text cannot become public without a human approving it, and no
 * caller can opt out of that by passing a different value.
 */

/**
 * Five submissions per IP per hour. Deliberately far tighter than the lead
 * forms' 5/minute: a lead is a customer trying to reach a business and a
 * retry is normal, while nobody legitimately writes five reviews an hour.
 * This is per-IP only — see the open question about review-bombing from
 * rotating addresses in the PR body.
 */
export const REVIEW_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

export async function createPendingReview(
  guard: Omit<PublicWriteContext, 'key' | 'limit' | 'windowMs'>,
  input: ReviewSubmission,
  database: Db = getDb(),
): Promise<void> {
  requirePublicWrite({ ...guard, key: 'reviews', ...REVIEW_RATE_LIMIT });

  // The listing is checked before the insert so an unknown id is a clean 400
  // rather than a foreign-key 500. It is also the only read this path does.
  const [listing] = await database
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, input.listingId))
    .limit(1);
  if (!listing) {
    throw new PublicWriteError('No encontramos ese negocio.', 'unknown_target');
  }

  await database.insert(reviews).values({
    listingId: input.listingId,
    author: input.author,
    rating: input.rating,
    body: input.body,
    status: 'pending',
  });
}

/**
 * Approved reviews for one listing, newest first — the public read.
 *
 * Unguarded on purpose: this is data the moderation queue already decided is
 * public. `dbConfigured()` makes it a no-op on the seed dataset (local dev and
 * the Playwright smoke run have no database and therefore no reviews at all),
 * the same way `lib/db/leads.ts` degrades.
 */
export async function listApprovedReviews(
  listingId: string,
  limit = 20,
  database: Db = getDb(),
): Promise<Review[]> {
  if (!dbConfigured()) return [];

  const rows = await database
    .select({
      author: reviews.author,
      rating: reviews.rating,
      body: reviews.body,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.listingId, listingId), eq(reviews.status, 'approved')))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    author: r.author,
    rating: r.rating,
    text: r.body,
    date: Math.floor(r.createdAt.getTime() / 1000),
  }));
}
