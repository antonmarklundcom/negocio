'use client';

import { useTranslations } from 'next-intl';

import { useState } from 'react';
import { Honeypot } from './Honeypot';
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, REVIEW_AUTHOR_MAX } from '@/lib/reviews';

/**
 * Public review submission (ROADMAP Phase D item 5) → POST /api/v1/reviews.
 *
 * Built like the lead forms (`ListingMessageForm`, `SumateForm`): a small
 * client component around a `fetch`, with the shared `<Honeypot />` field. The
 * per-IP rate limit and the honeypot check run server-side inside
 * `lib/db/reviews.ts` — nothing here is a defense.
 *
 * The copy says out loud that a review is read before it is published. A
 * visitor who is not told that assumes the site ate their text.
 */

const field =
  'w-full rounded-[10px] border border-line bg-cream px-3.5 py-3 text-[15px] text-ink outline-none focus:border-blue';

/**
 * Rating options. The stars and the word are ONE message per rating rather
 * than stars + a separate adjective: "★★★★ · Muy bueno" and "★★★★ · Very good"
 * happen to line up, but a language that puts the qualifier first would need
 * the whole string, and there are only five of them.
 */
const RATING_OPTIONS = [
  { value: '5', key: 'rating5' },
  { value: '4', key: 'rating4' },
  { value: '3', key: 'rating3' },
  { value: '2', key: 'rating2' },
  { value: '1', key: 'rating1' },
] as const;

export function ReviewForm({ listingId }: { listingId: string }) {
  const t = useTranslations('forms');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setStatus('sending');
    setError('');

    try {
      const res = await fetch('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          author: String(fd.get('author') ?? ''),
          rating: Number(fd.get('rating') ?? 0),
          body: String(fd.get('body') ?? ''),
          hp: String(fd.get('hp') ?? ''),
        }),
      });

      if (res.status === 429) {
        setStatus('error');
        setError(t('reviewRateLimited'));
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setError(t('reviewTooShort'));
        return;
      }

      form.reset();
      setStatus('sent');
    } catch {
      setStatus('error');
      setError(t('sendFailed'));
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-card border border-line bg-wabg p-5 text-center">
        <p className="font-serif text-[18px] font-semibold text-wa">{t('reviewThanks')}</p>
        <p className="mt-1.5 text-[14px] text-ink2">
          La vamos a leer antes de publicarla. Si cumple con las reglas del sitio, va a aparecer acá en poco tiempo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-card border border-line bg-paper p-5">
      <Honeypot />
      <div>
        <label htmlFor="review-author" className="mb-1.5 block text-[13px] font-bold">
          {t('reviewNameLabel')}
        </label>
        <input
          id="review-author"
          name="author"
          required
          maxLength={REVIEW_AUTHOR_MAX}
          placeholder={t('reviewNamePlaceholder')}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="review-rating" className="mb-1.5 block text-[13px] font-bold">
          {t('reviewRatingLabel')}
        </label>
        <select id="review-rating" name="rating" required defaultValue="" className={field}>
          <option value="" disabled>
            {t('reviewRatingPlaceholder')}
          </option>
          {RATING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.key)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="review-body" className="mb-1.5 block text-[13px] font-bold">
          {t('reviewBodyLabel')}
        </label>
        <textarea
          id="review-body"
          name="body"
          required
          rows={4}
          minLength={REVIEW_BODY_MIN}
          maxLength={REVIEW_BODY_MAX}
          placeholder={t('reviewBodyPlaceholder')}
          className={`${field} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-card bg-blue py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-blued disabled:opacity-60"
      >
        {status === 'sending' ? t('sending') : t('reviewSubmit')}
      </button>

      <p className="text-center text-[12px] text-ink3">
        Las reseñas se revisan antes de publicarse. No pidas ni dejes datos de contacto.
      </p>
      {status === 'error' && <p className="text-center text-[13px] text-terra">{error}</p>}
    </form>
  );
}
