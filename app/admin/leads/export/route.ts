import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { parseLeadListParams } from '@/lib/admin/validation';
import { toCsv } from '@/lib/admin/csv';
import { listLeadsForExport } from '@/lib/db/leads-admin';

/**
 * GET /admin/leads/export — the current filter, as CSV (ROADMAP W2-5).
 *
 * `listLeadsForExport` calls `requireRole(['admin'])` itself, as its first
 * statement, exactly like the page's `listLeads`. This route only turns the
 * throw into a 404 — the same answer `/admin` gives the unauthorised, because
 * "this exists but you may not see it" is itself information.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { q, source } = parseLeadListParams(Object.fromEntries(url.searchParams));

  let rows;
  try {
    rows = await listLeadsForExport(await currentUser(), { q, source });
  } catch {
    notFound();
  }

  const csv = toCsv(
    [
      'id',
      'fecha',
      'origen',
      'nombre',
      'contacto',
      'email',
      'telefono',
      'negocio_id',
      'negocio_slug',
      'nombre_negocio',
      'rubro',
      'ciudad',
      'mensaje',
      'entregado_a',
      'sinks_configurados',
    ],
    rows.map((r) => [
      r.id,
      r.createdAt,
      r.source,
      r.name,
      r.contact,
      r.email,
      r.phone,
      r.listingId,
      r.listingSlug,
      r.businessName,
      r.category,
      r.city,
      r.message,
      r.deliveredSinks,
      r.configuredSinks,
    ]),
  );

  // The date is in the filename rather than only in the rows: these files end
  // up in a downloads folder next to last month's, and "leads.csv (3)" tells
  // nobody anything.
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${stamp}.csv"`,
      // Never cached: it is per-filter, and it is other people's contact details.
      'Cache-Control': 'no-store',
    },
  });
}
