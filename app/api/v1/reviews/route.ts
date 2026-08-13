import { NextResponse } from 'next/server';
import { REVIEWS_ENABLED } from '@/lib/config';
import { dbConfigured } from '@/lib/db/client';
import { createPendingReview } from '@/lib/db/reviews';
import { isPublicWriteError } from '@/lib/public-write';
import { reviewSubmissionSchema } from '@/lib/reviews';
import { clientIp } from '@/lib/rate-limit';

/**
 * POST /api/v1/reviews — public review submission (ROADMAP Phase D item 5),
 * shaped exactly like `/api/v1/leads`.
 *
 * Spam defenses are NOT implemented here: `createPendingReview` runs the
 * honeypot and the per-IP rate limit itself, as its first statement, so the
 * query-module function is guarded even if some future caller skips this
 * route. This handler only turns the thrown reasons into status codes.
 *
 * Both the reviews flag and a database are required. Without either there is
 * nothing to submit to, and the endpoint 404s rather than 500-ing on a
 * connection that was never configured.
 */
export async function POST(request: Request) {
  if (!REVIEWS_ENABLED || !dbConfigured()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const honeypot =
    json && typeof json === 'object' && typeof (json as { hp?: unknown }).hp === 'string'
      ? (json as { hp: string }).hp
      : '';
  if (json && typeof json === 'object') delete (json as { hp?: unknown }).hp;

  const parsed = reviewSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_review', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await createPendingReview({ ip: clientIp(request), honeypot }, parsed.data);
  } catch (err) {
    if (isPublicWriteError(err)) {
      // A bot that filled the honeypot is told the same thing a real visitor
      // is told, and its submission is dropped — same behaviour as the lead
      // endpoint. Telling it otherwise only teaches it to leave `hp` empty.
      if (err.reason === 'honeypot') return NextResponse.json({ ok: true, status: 'pending' });
      if (err.reason === 'unknown_target') {
        return NextResponse.json({ error: 'unknown_listing' }, { status: 400 });
      }
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(err.retryAfter) } },
      );
    }
    console.error('[reviews] failed to store a submission:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: 'pending' });
}
