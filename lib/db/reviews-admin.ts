import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from './client';
import type { Db } from './connection';
import { requireRole, AuthError } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { logActivity } from './activity-log';
import { listings, reviews, type ReviewStatus } from './schema';
import { rollupFromRatings } from '@/lib/reviews';

/**
 * The moderation queue for first-party reviews (ROADMAP Phase D item 5).
 * THIS MODULE IS THE AUTHORIZATION BOUNDARY: every exported function calls
 * `requireRole` as its first statement, before touching the database, exactly
 * like `lib/db/listings-admin.ts`.
 *
 * Guarded `['admin', 'editor']`, NOT `['admin']` like `lib/db/leads-admin.ts`.
 * The split those two guards encode is "content" vs "a member of the public's
 * contact details": an editor already writes every word a visitor reads on a
 * listing page, and a review row carries a display name, a star rating and a
 * body — no phone, no email, nothing to reach the author with (see
 * `lib/reviews.ts`). Moderating text that will appear on a listing page is the
 * editor role's existing job; reading a lead's phone number is not.
 *
 * Rejecting is a status change, never a delete: a rejected review is evidence
 * (of abuse, of a competitor, of a moderator's own mistake) and the row is
 * cheap to keep. See the PR body's open question on purging.
 */

export const REVIEWS_PAGE_SIZE = 25;

export interface AdminReviewRow {
  id: number;
  listingId: string;
  listingName: string;
  listingSlug: string;
  author: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  createdAt: Date;
}

export interface ReviewListResult {
  rows: AdminReviewRow[];
  total: number;
  page: number;
  pageSize: number;
}

const LIST_COLUMNS = {
  id: reviews.id,
  listingId: reviews.listingId,
  listingName: listings.name,
  listingSlug: listings.slug,
  author: reviews.author,
  rating: reviews.rating,
  body: reviews.body,
  status: reviews.status,
  createdAt: reviews.createdAt,
} as const;

export async function listReviews(
  actor: SessionUser | null,
  params: { status?: ReviewStatus; page?: number } = {},
  database: Db = getDb(),
): Promise<ReviewListResult> {
  requireRole(actor, ['admin', 'editor']);

  const page = Math.max(1, Math.floor(params.page ?? 1));
  const where = params.status ? eq(reviews.status, params.status) : undefined;

  // Oldest first for the pending queue: a review waiting three days must not
  // be pushed off the page by today's submissions.
  const orderBy = params.status === 'pending' ? reviews.createdAt : desc(reviews.createdAt);

  const rows = await database
    .select(LIST_COLUMNS)
    .from(reviews)
    .innerJoin(listings, eq(listings.id, reviews.listingId))
    .where(where)
    .orderBy(orderBy)
    .limit(REVIEWS_PAGE_SIZE)
    .offset((page - 1) * REVIEWS_PAGE_SIZE);

  const [counted] = await database
    .select({ total: sql<number>`count(*)` })
    .from(reviews)
    .where(where);

  return { rows, total: Number(counted?.total ?? 0), page, pageSize: REVIEWS_PAGE_SIZE };
}

/** For the dashboard tile — "N reseñas esperando moderación". */
export async function countPendingReviews(actor: SessionUser | null, database: Db = getDb()): Promise<number> {
  requireRole(actor, ['admin', 'editor']);
  const [row] = await database
    .select({ total: sql<number>`count(*)` })
    .from(reviews)
    .where(eq(reviews.status, 'pending'));
  return Number(row?.total ?? 0);
}

/**
 * Recompute `listings.rating` / `listings.reviews_count` from the listing's
 * APPROVED reviews. Always called from inside the moderating transaction, so
 * the roll-up cannot end up describing a set of reviews that no longer exists.
 *
 * This is what "reviews own those two columns" means in practice: they are
 * derived, never typed in, and re-derived from scratch on every decision
 * rather than incremented — an increment that misses one code path drifts
 * silently and forever.
 */
async function recomputeListingRating(tx: Db, listingId: string): Promise<void> {
  const approved = await tx
    .select({ rating: reviews.rating })
    .from(reviews)
    .where(and(eq(reviews.listingId, listingId), eq(reviews.status, 'approved')));

  const rollup = rollupFromRatings(approved.map((r) => r.rating));
  await tx
    .update(listings)
    .set({ rating: rollup.rating, reviewsCount: rollup.reviewsCount })
    .where(eq(listings.id, listingId));
}

async function setReviewStatus(
  user: SessionUser,
  id: number,
  status: Exclude<ReviewStatus, 'pending'>,
  database: Db,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [before] = await tx
      .select({ id: reviews.id, listingId: reviews.listingId, status: reviews.status })
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);
    if (!before) throw new AuthError('No encontramos esa reseña.', 'forbidden');

    await tx.update(reviews).set({ status }).where(eq(reviews.id, id));

    // Both directions matter: approving adds a rating to the average, and
    // rejecting an already-approved review has to take it back out.
    await recomputeListingRating(tx, before.listingId);

    await logActivity(tx, {
      userId: user.id,
      entityType: 'review',
      entityId: String(id),
      action: 'update',
      before: { status: before.status, listingId: before.listingId },
      after: { status, listingId: before.listingId },
    });
  });
}

/**
 * `requireRole` is the first statement of BOTH of these, not just of the
 * shared helper they delegate to — the rule is about what an exported function
 * does before anything else, and a guard one call away is a guard a later edit
 * can quietly route around.
 */
export async function approveReview(
  actor: SessionUser | null,
  id: number,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);
  return setReviewStatus(user, id, 'approved', database);
}

export async function rejectReview(
  actor: SessionUser | null,
  id: number,
  database: Db = getDb(),
): Promise<void> {
  const user = requireRole(actor, ['admin', 'editor']);
  return setReviewStatus(user, id, 'rejected', database);
}
