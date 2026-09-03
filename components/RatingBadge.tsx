'use client';

import { useTranslations } from 'next-intl';
import { REVIEWS_ENABLED } from '@/lib/config';

/**
 * Rating display shared by ListingCard, FeaturedCard and the detail page.
 * Fixed 5-star glyph string, not a partial-fill renderer — that's the
 * existing convention (see the detail page's original `Rating()`).
 *
 * Honesty gate: renders nothing without a real rating, and nothing at all
 * while `REVIEWS_ENABLED` is off — never fabricate a rating.
 */
export function RatingBadge({ rating, reviewsCount }: { rating?: number; reviewsCount?: number }) {
  const t = useTranslations('detail');
  if (!REVIEWS_ENABLED || !rating) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <span className="tracking-wide text-terragold">★★★★★</span> {rating.toFixed(1)}
      {reviewsCount ? (
        <span className="font-medium text-ink3">{t('reviewsCount', { count: reviewsCount })}</span>
      ) : null}
    </span>
  );
}
