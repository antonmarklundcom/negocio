import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { asuncionMonthRange, asuncionMonthRanges } from '@/lib/hours';
import { formatGs } from '@/lib/format';
import { listSales, salesMonthTotals, SALES_PAGE_SIZE } from '@/lib/db/sales-admin';
import { SALE_METHOD_LABELS, SALE_PACKAGE_LABELS } from '@/lib/admin/labels';

/**
 * The revenue record (ROADMAP W2-3 / D5).
 *
 * Admin-only — `listSales` and `salesMonthTotals` enforce that themselves and
 * this page turns the throw into a 404, the same answer the rest of the panel
 * gives. There is no "record a sale" form anywhere: a sale is written inside
 * the same transaction as the package it pays for, so one cannot exist without
 * the other.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Ventas' };

function one(params: Record<string, string | string[] | undefined>, key: string): string {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
}

export default async function SalesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(one(searchParams, 'page') || '1', 10) || 1);
  // "This month" is the default view and "everything" is one click away.
  // Defaulting to everything would put the year-to-date total at the top of a
  // screen whose job is answering "how did this month go".
  const scope = one(searchParams, 'scope') === 'todo' ? 'todo' : 'mes';
  const month = asuncionMonthRange();
  const range = scope === 'mes' ? month : undefined;

  const actor = await currentUser();
  let result;
  let months;
  try {
    [result, months] = await Promise.all([
      listSales(actor, { range, page }),
      salesMonthTotals(actor, asuncionMonthRanges(6)),
    ]);
  } catch {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(result.total / SALES_PAGE_SIZE));
  const pageHref = (p: number) =>
    `/admin/ventas?${new URLSearchParams({ scope, page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-[28px] font-semibold">Ventas</h1>
        <Link
          href={`/admin/ventas/export?scope=${scope}`}
          prefetch={false}
          className="rounded-card border-[1.5px] border-blue px-4 py-2.5 text-sm font-bold text-blue"
        >
          Descargar CSV
        </Link>
      </div>

      <section className="rounded-card border border-line bg-cream/60 p-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-serif text-[28px] font-semibold">{formatGs(result.totalGs)}</span>
          <span className="text-[15px] text-ink2">
            {result.total} {result.total === 1 ? 'venta' : 'ventas'}
            {scope === 'mes' ? <> en <span className="capitalize">{month.monthLabel}</span></> : ' en total'}
          </span>
          <Link
            href={`/admin/ventas?scope=${scope === 'mes' ? 'todo' : 'mes'}`}
            className="ml-auto text-[14px] font-bold text-blue hover:underline"
          >
            {scope === 'mes' ? 'Ver todo' : 'Ver solo este mes'}
          </Link>
        </div>

        {months.some((m) => m.count > 0) && (
          <ul className="mt-5 space-y-1.5">
            {months.map((m) => {
              const peak = Math.max(...months.map((x) => x.totalGs), 1);
              return (
                <li key={m.monthLabel} className="flex items-center gap-3 text-[13px]">
                  <span className="w-28 shrink-0 capitalize text-ink2">{m.monthLabel}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-line2">
                    <span
                      className="block h-full rounded-full bg-blue"
                      style={{ width: `${Math.round((m.totalGs / peak) * 100)}%` }}
                    />
                  </span>
                  <span className="w-36 shrink-0 text-right font-bold text-ink">{formatGs(m.totalGs)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {result.rows.length === 0 ? (
        <p className="rounded-card border border-line bg-white px-4 py-8 text-center text-[15px] text-ink2">
          {scope === 'mes' ? 'Todavía no hubo ventas este mes.' : 'Todavía no se registró ninguna venta.'}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-line bg-cream/60">
                  {['Fecha', 'Negocio', 'Paquete', 'Monto', 'Medio', 'Vendió'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-ink2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line2 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-ink2">
                      {row.createdAt.toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' })}
                    </td>
                    <td className="px-4 py-3">
                      {/* The listing may have been hard-deleted since; the name
                          is denormalised onto the sale so the report still
                          says who paid. */}
                      <Link href={`/admin/negocios/${row.listingId}`} className="font-bold text-blue hover:underline">
                        {row.listingName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {SALE_PACKAGE_LABELS[row.packageKind]} · {row.days} días
                    </td>
                    <td className="px-4 py-3 font-bold">{formatGs(row.amountGs)}</td>
                    <td className="px-4 py-3">{SALE_METHOD_LABELS[row.method]}</td>
                    <td className="px-4 py-3">{row.sellerName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-[14px]">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className="font-bold text-blue hover:underline">
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink2">
                Página {result.page} de {totalPages}
              </span>
              {result.page < totalPages ? (
                <Link href={pageHref(result.page + 1)} className="font-bold text-blue hover:underline">
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
