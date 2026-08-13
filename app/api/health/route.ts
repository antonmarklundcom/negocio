import { NextResponse } from 'next/server';

/**
 * GET /api/health — the endpoint an uptime monitor (UptimeRobot) polls.
 *
 * Deliberately does NOT touch the database: this proves the Next.js server
 * itself is up and serving, which is what "is the site down" actually means
 * for visitors — most of the site (search, category pages, listing pages)
 * reads through the seam in `lib/listings-repo.ts` and keeps working even if
 * MySQL is briefly unreachable. A health check that 500s on a blip in a
 * connection the site doesn't strictly need would page someone for nothing.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'negocio.com.py', time: new Date().toISOString() });
}
