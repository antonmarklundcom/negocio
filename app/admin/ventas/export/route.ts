import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { asuncionMonthRange } from '@/lib/hours';
import { toCsv } from '@/lib/admin/csv';
import { listSalesForExport } from '@/lib/db/sales-admin';

/**
 * GET /admin/ventas/export — the revenue record as CSV (ROADMAP W2-3).
 *
 * `listSalesForExport` calls `requireRole(['admin'])` itself; this route only
 * turns the throw into a 404. `toCsv` is the same module the leads export uses,
 * so the formula-injection neutralisation and the Excel BOM come for free —
 * the business name is written by staff but the file still opens in Excel.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = url.searchParams.get('scope') === 'todo' ? undefined : asuncionMonthRange();

  let rows;
  try {
    rows = await listSalesForExport(await currentUser(), range);
  } catch {
    notFound();
  }

  const csv = toCsv(
    ['id', 'fecha', 'negocio_id', 'negocio', 'paquete', 'dias', 'monto_gs', 'medio', 'vendio'],
    rows.map((r) => [
      r.id,
      r.createdAt,
      r.listingId,
      r.listingName,
      r.packageKind,
      r.days,
      // Plain digits, no separators: this column is summed in a spreadsheet.
      r.amountGs,
      r.method,
      r.sellerName,
    ]),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ventas-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
