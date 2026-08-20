import { getTranslations } from 'next-intl/server';
import type { Review } from '@/lib/types';
import type { Locale } from '@/lib/i18n/routing';
import { TIMEZONE } from '@/lib/config';
import { ReviewForm } from '../ReviewForm';

/**
 * Approved reviews + the submission form on a listing page (ROADMAP Phase D
 * item 5). A server component: the only client code here is the form itself.
 *
 * Rendered only when `NEXT_PUBLIC_REVIEWS_ENABLED` is on AND a database is
 * configured — the caller decides that (`app/(public)/lugar/[slug]/page.tsx`),
 * because with no database there is nowhere for a submission to land.
 *
 * With no approved reviews yet the section still renders the form and says so
 * honestly ("todavía no tiene reseñas"), rather than inventing a rating or
 * hiding the ability to leave the first one.
 */
export async function Reviews({
  listingId,
  reviews,
  locale,
}: {
  listingId: string;
  reviews: Review[];
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: 'reviews' });
  return (
    <section id="resenas">
      <h2 className="mb-3 font-serif text-[21px] font-semibold">{t('heading')}</h2>

      {reviews.length === 0 ? (
        <p className="mb-4 text-[15px] text-ink2">
          {t('empty')}
        </p>
      ) : (
        <ul className="mb-5 space-y-3">
          {reviews.map((r, i) => (
            <li key={`${r.date}-${i}`} className="rounded-card border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[15px] font-bold">{r.author}</span>
                <Stars rating={r.rating} />
                <time
                  dateTime={new Date(r.date * 1000).toISOString()}
                  className="ml-auto text-[12px] text-ink3"
                >
                  {formatReviewDate(r.date)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink2">{r.text}</p>
            </li>
          ))}
        </ul>
      )}

      <ReviewForm listingId={listingId} />
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-[13px] tracking-wide text-terragold" aria-label={`${full} de 5 estrellas`}>
      {'★'.repeat(full)}
      <span className="text-ink3">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

/** `America/Asuncion`, like every other date the site prints. */
function formatReviewDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(unixSeconds * 1000));
}
