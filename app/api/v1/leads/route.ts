import { NextResponse } from 'next/server';
import { handleLead, leadSchema } from '@/lib/leads';

/**
 * POST /api/v1/leads — single lead orchestrator endpoint (§7).
 * Reads the raw text body so navigator.sendBeacon (which sends a Blob without a
 * reliable JSON content-type) works alongside a normal fetch.
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

  const parsed = leadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_lead', details: parsed.error.flatten() }, { status: 400 });
  }

  // Fan-out failures must never fail the user's request.
  const outcome = await handleLead(parsed.data);
  return NextResponse.json({ ok: true, ...outcome });
}
