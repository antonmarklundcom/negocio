import { NextResponse } from 'next/server';
import { handleLead, leadSchema } from '@/lib/leads';
import { rateLimit, clientIp } from '@/lib/rate-limit';

/**
 * POST /api/v1/leads — single lead orchestrator endpoint (§7).
 * Reads the raw text body so navigator.sendBeacon (which sends a Blob without a
 * reliable JSON content-type) works alongside a normal fetch.
 *
 * Spam defenses:
 *  - honeypot: a hidden `hp` field; if a bot fills it we silently accept and drop.
 *  - per-IP rate limit; whatsapp-tracking beacons get a looser budget than forms.
 */
export async function POST(request: Request) {
  let raw = '';
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: 'unreadable_body' }, { status: 400 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Honeypot: real users never see or fill `hp`. Pretend success, drop silently.
  if (json && typeof json === 'object' && 'hp' in json && (json as { hp?: unknown }).hp) {
    return NextResponse.json({ ok: true, accepted: true, delivered: 0, sinks: 0 });
  }
  if (json && typeof json === 'object') delete (json as { hp?: unknown }).hp;

  const parsed = leadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_lead', details: parsed.error.flatten() }, { status: 400 });
  }

  // Rate limit per IP. WhatsApp-click beacons are frequent + low-risk, so they
  // get a wider window than the human-submitted forms.
  const ip = clientIp(request);
  const isBeacon = parsed.data.source === 'listing_whatsapp';
  const { ok, retryAfter } = rateLimit(`leads:${parsed.data.source}:${ip}`, {
    limit: isBeacon ? 30 : 5,
    windowMs: 60_000,
  });
  if (!ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  // Fan-out failures must never fail the user's request.
  const outcome = await handleLead(parsed.data);
  return NextResponse.json({ ok: true, ...outcome });
}
