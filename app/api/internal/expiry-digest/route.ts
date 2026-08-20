import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/config';
import { dbConfigured } from '@/lib/db/client';
import { listExpiringSoon } from '@/lib/db/listings-admin';
import { buildExpiryDigest } from '@/lib/admin/digest';
import { mailConfigured, sendMail, staffRecipients } from '@/lib/mail';

/**
 * POST /api/internal/expiry-digest — the weekly "expiring soon" digest to
 * staff (ROADMAP W2-4 / D6).
 *
 * Hostinger's Node app has no cron, so this is a URL an external scheduler
 * (cron-job.org, UptimeRobot) hits once a week. That makes the token the ONLY
 * thing standing between the public internet and a mail send, so:
 *
 *  - the token is compared with `timingSafeEqual`, not `===`, and only after
 *    a length check, because `===` on secrets leaks their prefix by timing;
 *  - an unset `EXPIRY_DIGEST_TOKEN` means the endpoint 404s rather than
 *    running unguarded — "forgot to set it" must never mean "open to
 *    everyone";
 *  - the whole route 404s, never 401s, for the same reason `/admin` does.
 *
 * POST, not GET: a GET is what a crawler, a link preview or a browser prefetch
 * issues, and every one of them would send mail.
 *
 * The digest is a REPORT, not a mutation: it reads and mails, and writes
 * nothing. Running it twice sends two identical emails and changes no state,
 * which is the right failure mode for something a third-party scheduler
 * retries on a timeout.
 */
export const dynamic = 'force-dynamic';

/** ≤14 days out (D6). */
const WINDOW_SECONDS = 14 * 86_400;

function tokenMatches(provided: string): boolean {
  const expected = process.env.EXPIRY_DIGEST_TOKEN ?? '';
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, so the length is compared
  // first — that leaks the token's LENGTH and nothing else.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function providedToken(request: Request, url: URL): string {
  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  // A query-string token is second-best but necessary: several free cron
  // services cannot set a header at all.
  return url.searchParams.get('token') ?? '';
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!tokenMatches(providedToken(request, url))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!dbConfigured() || !mailConfigured()) {
    // A misconfiguration must be loud to the operator (a non-200 the cron
    // service reports) rather than a silent 200 that looks like a healthy run.
    return NextResponse.json(
      { error: 'not_configured', database: dbConfigured(), mail: mailConfigured() },
      { status: 503 },
    );
  }

  const recipients = staffRecipients();
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'no_recipients' }, { status: 503 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  // This is the one caller in the app with no signed-in human behind it, so it
  // constructs the actor it runs as explicitly rather than reaching for a
  // "skip the guard" path. `listExpiringSoon` still runs its `requireRole`.
  const digest = buildExpiryDigest(
    await listExpiringSoon({ id: 0, role: 'admin', ownerId: null, mustChangePassword: false }, nowSeconds, WINDOW_SECONDS),
    nowSeconds,
    SITE_URL,
  );

  if (digest.count === 0) {
    // Nothing to say. A weekly "nothing to do" is how a digest becomes a
    // folder nobody opens.
    return NextResponse.json({ ok: true, sent: false, count: 0 });
  }

  await sendMail({
    to: recipients.join(', '),
    subject: `[negocio.com.py] ${digest.subject}`,
    text: digest.text,
  });

  return NextResponse.json({ ok: true, sent: true, count: digest.count });
}
