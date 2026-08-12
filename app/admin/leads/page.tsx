import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { parseLeadListParams } from '@/lib/admin/validation';
import { LEAD_SOURCE_LABELS } from '@/lib/admin/labels';
import { listLeads, LEADS_PAGE_SIZE, type LeadRow } from '@/lib/db/leads-admin';
import { LEAD_SOURCES } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Leads' };

function contactOf(row: LeadRow): string {
  return row.contact || row.email || row.phone || '—';
}

function truncate(text: string | null, max: number): string {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { q, page, source } = parseLeadListParams(searchParams);

  // `listLeads` calls requireRole itself: admin-only (BUILD-SPEC-PR4 open
  // question 1 — a lead carries a member of the public's contact details).
  let result;
  try {
    result = await listLeads(await currentUser(), { q, page, source });
  } catch {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(result.total / LEADS_PAGE_SIZE));
  const buildPageHref = (p: number) =>
    `/admin/leads?${new URLSearchParams({ ...(q ? { q } : {}), ...(source ? { source } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[28px] font-semibold">Leads</h1>

      <form method="GET" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscá por nombre, contacto o negocio"
          aria-label="Buscar leads"
          className="min-w-[220px] flex-1 rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        />
        <select
          name="source"
          defaultValue={source ?? ''}
          className="rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        >
          <option value="">Todos los orígenes</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {LEAD_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-card border-[1.5px] border-blue px-4 py-2.5 text-sm font-bold text-blue">
          Buscar
        </button>
      </form>

      {/* No editHref exists for a lead — rendered directly rather than through
          AdminTable, which requires one; a clickable-looking row that does
          nothing would be worse than a plain table. */}
      {result.rows.length === 0 ? (
        <p className="rounded-card border border-line bg-white px-4 py-8 text-center text-[15px] text-ink2">
          {q || source ? 'Ningún lead coincide con esa búsqueda.' : 'Todavía no llegó ningún lead.'}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[900px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-line bg-cream/60">
                  {['Fecha', 'Origen', 'Contacto', 'Negocio', 'Mensaje', 'Entrega'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-ink2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3 align-middle font-mono text-[13px] tabular-nums">
                      {row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-3 align-middle">{LEAD_SOURCE_LABELS[row.source]}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="font-bold">{row.name ?? '—'}</div>
                      <div className="text-[13px] text-ink2">{contactOf(row)}</div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {row.listingSlug ? (
                        <Link href={`/admin/negocios/${row.listingId ?? ''}`} className="text-blue hover:underline">
                          {row.listingSlug}
                        </Link>
                      ) : (
                        row.businessName ?? '—'
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">{truncate(row.message, 80)}</td>
                    <td className="px-4 py-3 align-middle">
                      {row.configuredSinks ? `${row.deliveredSinks ?? 0}/${row.configuredSinks}` : 'Sin webhooks'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-between text-[14px]" aria-label="Paginación">
              {result.page > 1 ? (
                <Link href={buildPageHref(result.page - 1)} className="font-bold text-blue hover:underline">
                  ← Anterior
                </Link>
              ) : (
                <span className="text-ink2">← Anterior</span>
              )}
              <span className="text-ink2">
                Página <span className="font-mono tabular-nums">{result.page}</span> de{' '}
                <span className="font-mono tabular-nums">{totalPages}</span>
              </span>
              {result.page < totalPages ? (
                <Link href={buildPageHref(result.page + 1)} className="font-bold text-blue hover:underline">
                  Siguiente →
                </Link>
              ) : (
                <span className="text-ink2">Siguiente →</span>
              )}
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
