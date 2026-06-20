import { NextResponse } from 'next/server';
import { getListingBySlug } from '@/lib/listings-repo';

/** GET /api/v1/listings/[slug] — a single listing through the repo seam. */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const listing = await getListingBySlug(params.slug);
  if (!listing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(listing, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
  });
}
