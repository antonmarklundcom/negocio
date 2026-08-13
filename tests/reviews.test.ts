import { describe, expect, it } from 'vitest';

import { reviewSubmissionSchema, rollupFromRatings, REVIEW_BODY_MAX } from '@/lib/reviews';
import { parseReviewListParams } from '@/lib/admin/validation';

/**
 * The pure half of first-party reviews (ROADMAP Phase D item 5): the public
 * submission contract, the rating roll-up, and the moderation queue's list
 * params. No database, no session, no clock.
 */

const VALID = {
  listingId: 'listing-1',
  author: 'Vecina de Villa Morra',
  rating: 5,
  body: 'Atendieron rapidísimo y el precio fue el que me pasaron por WhatsApp.',
};

describe('reviewSubmissionSchema', () => {
  it('accepts a well-formed submission', () => {
    const parsed = reviewSubmissionSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
  });

  it('trims the author and the body', () => {
    const parsed = reviewSubmissionSchema.parse({ ...VALID, author: '  Ana  ', body: `  ${VALID.body}  ` });
    expect(parsed.author).toBe('Ana');
    expect(parsed.body).toBe(VALID.body);
  });

  it.each([0, 6, 3.5, -1])('rejects a rating of %s', (rating) => {
    expect(reviewSubmissionSchema.safeParse({ ...VALID, rating }).success).toBe(false);
  });

  it('rejects a body that is too short to say anything', () => {
    expect(reviewSubmissionSchema.safeParse({ ...VALID, body: 'buenísimo' }).success).toBe(false);
  });

  it('rejects a body past the column limit rather than truncating it', () => {
    expect(reviewSubmissionSchema.safeParse({ ...VALID, body: 'a'.repeat(REVIEW_BODY_MAX + 1) }).success).toBe(false);
  });

  it('rejects a missing listing id', () => {
    expect(reviewSubmissionSchema.safeParse({ ...VALID, listingId: '' }).success).toBe(false);
  });

  it('rejects a rating sent as a string — the client must send a number', () => {
    expect(reviewSubmissionSchema.safeParse({ ...VALID, rating: '5' }).success).toBe(false);
  });
});

describe('rollupFromRatings', () => {
  it('returns NULLs when there are no approved reviews — never 0 (ROADMAP rule 8)', () => {
    expect(rollupFromRatings([])).toEqual({ rating: null, reviewsCount: null });
  });

  it('averages to one decimal, as the DECIMAL(2,1) column stores it', () => {
    expect(rollupFromRatings([5, 4])).toEqual({ rating: '4.5', reviewsCount: 2 });
    expect(rollupFromRatings([5, 4, 4])).toEqual({ rating: '4.3', reviewsCount: 3 });
    expect(rollupFromRatings([1, 2])).toEqual({ rating: '1.5', reviewsCount: 2 });
  });

  it('keeps a whole number as one decimal, so the page never prints "5"', () => {
    expect(rollupFromRatings([5, 5, 5])).toEqual({ rating: '5.0', reviewsCount: 3 });
  });

  it('rounds half up', () => {
    // 3.25 → 3.3, not 3.2.
    expect(rollupFromRatings([4, 4, 3, 2])).toEqual({ rating: '3.3', reviewsCount: 4 });
  });

  it('counts every approved review, including duplicates of the same rating', () => {
    expect(rollupFromRatings([4, 4, 4, 4, 4, 4]).reviewsCount).toBe(6);
  });
});

describe('parseReviewListParams', () => {
  it('defaults to the pending queue', () => {
    expect(parseReviewListParams({})).toEqual({ page: 1, status: 'pending' });
  });

  it('accepts the three real statuses', () => {
    expect(parseReviewListParams({ estado: 'approved' }).status).toBe('approved');
    expect(parseReviewListParams({ estado: 'rejected' }).status).toBe('rejected');
    expect(parseReviewListParams({ estado: 'pending' }).status).toBe('pending');
  });

  it('falls back to pending for anything else, instead of querying a bogus enum value', () => {
    expect(parseReviewListParams({ estado: 'aprobadas' }).status).toBe('pending');
    expect(parseReviewListParams({ estado: "' OR 1=1 --" }).status).toBe('pending');
  });

  it('falls back to page 1 for an out-of-range page', () => {
    expect(parseReviewListParams({ page: '0' }).page).toBe(1);
    expect(parseReviewListParams({ page: 'dos' }).page).toBe(1);
    expect(parseReviewListParams({ page: '3' }).page).toBe(3);
  });
});
