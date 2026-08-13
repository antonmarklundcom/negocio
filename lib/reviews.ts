import { z } from 'zod';

/**
 * First-party reviews (ROADMAP Phase D item 5) — the PURE half: the public
 * submission contract and the rating roll-up maths. No database, no session,
 * no clock, so every rule here is unit-testable without MySQL (the same
 * arrangement as `lib/admin/validation.ts`).
 *
 * The submission deliberately captures NO contact details: a name, a rating
 * and a body, nothing else. That is what keeps the moderation queue out of the
 * "a member of the public's phone number" class that makes `/admin/leads`
 * admin-only, and it is why an editor can moderate reviews.
 */

export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;
export const REVIEW_AUTHOR_MAX = 120;
export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 2000;

/** Zod, like `lib/leads.ts` — the public write paths share one validation style. */
export const reviewSubmissionSchema = z.object({
  listingId: z.string().min(1).max(64),
  author: z.string().trim().min(2).max(REVIEW_AUTHOR_MAX),
  rating: z.number().int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  body: z.string().trim().min(REVIEW_BODY_MIN).max(REVIEW_BODY_MAX),
});

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;

export interface RatingRollup {
  /** DECIMAL(2,1) as a string, exactly as the column stores it. NULL when there is nothing real to show. */
  rating: string | null;
  reviewsCount: number | null;
}

/**
 * The roll-up that `listings.rating` / `listings.reviews_count` now hold,
 * computed from the APPROVED ratings of one listing.
 *
 * No approved reviews means both columns go back to NULL, never `0` and never
 * a stale leftover: ROADMAP rule 8 — a column with no real answer stays empty.
 * Averaged in JS rather than by `AVG()` so the rounding is pinned down here
 * and testable; a listing's approved set is dozens of rows, not millions.
 */
export function rollupFromRatings(ratings: readonly number[]): RatingRollup {
  if (ratings.length === 0) return { rating: null, reviewsCount: null };
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  const average = sum / ratings.length;
  // One decimal, half-up — the column is DECIMAL(2,1) and the page prints
  // `rating.toFixed(1)`, so rounding anywhere else would show a value the
  // database does not hold.
  const rounded = Math.round(average * 10) / 10;
  return { rating: rounded.toFixed(1), reviewsCount: ratings.length };
}
