import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getListings } from '@/lib/listings-repo';

/** GET /api/v1/listings — filtered, paginated listing query (§7). */
const querySchema = z.object({
  categoria: z.string().optional(),
  ciudad: z.string().optional(),
  zona: z.string().optional(),
  q: z.string().optional(),
  abierto: z
    .enum(['1', 'true', '0', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  sort: z.enum(['relevancia', 'destacados', 'nombre']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query', details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await getListings(parsed.data);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
  });
}
