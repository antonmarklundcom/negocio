import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { currentUser } from '@/lib/auth/session';
import { parseReviewListParams } from '@/lib/admin/validation';
import { REVIEW_STATUS_LABELS } from '@/lib/admin/labels';
import { listReviews, REVIEWS_PAGE_SIZE, type AdminReviewRow } from '@/lib/db/reviews-admin';
import { REVIEW_STATUSES } from '@/lib/db/schema';
import { listingPath } from '@/lib/config';
import { approveReviewAction, rejectReviewAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Reseñas' };

/**
 * The moderation queue (ROADMAP Phase D item 5). Opens on `pending`, oldest
 * first — the queue's job is what is still waiting, and a review that has been
 * waiting three days must not be pushed off the page by today's submissions.
 *
 * `listReviews` calls `requireRole(['admin', 'editor'])` itself. Editors reach
 * this: a review is public-facing content, which is already the editor role's
 * job, and it carries no contact details (that is what makes `/admin/leads`
 * admin-only).
 */
export default async function ReviewsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const { page, status } = parseReviewListParams(searchParams);
  const error = typeof searchParams.error === 'string' ? searchParams.error : undefined;

  let result;
  try {
    result = await listReviews(await currentUser(), { page, status });
  } catch {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(result.total / REVIEWS_PAGE_SIZE));
  const buildPageHref = (p: number) =>
    `/admin/resenas?${new URLSearchParams({ estado: status, page: String(p) })}`;

  const columns: AdminColumn<AdminReviewRow>[] = [
    {
      header: 'Fecha',
      numeric: true,
      cell: (row) => row.createdAt.toISOString().slice(0, 10),
    },
    {
      header: 'Negocio',
      cell: (row) => (
        <Link href={`/admin/negocios/${row.listingId}`} className="font-bold text-blue hover:underline">
          {row.listingName}
        </Link>
      ),
    },
    { header: 'Autor', cell: (row) => row.author },
    {
      header: 'Puntuación',
      numeric: true,
      cell: (row) => `${row.rating}/5`,
    },
    {
      header: 'Reseña',
      cell: (row) => <span className="block max-w-[380px] whitespace-pre-line">{row.body}</span>,
    },
    { header: 'Estado', cell: (row) => REVIEW_STATUS_LABELS[row.status] },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] font-semibold">Reseñas</h1>
        <p className="mt-1 text-[15px] text-ink2">
          Nada de lo que escribe el público se publica solo. Aprobá lo que sea real y rechazá lo demás; el promedio
          de estrellas del negocio se recalcula en el momento.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-card border border-terra bg-terra/10 px-4 py-3 text-[14px] text-ink">
          {error}
        </p>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por estado">
        {REVIEW_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/resenas?estado=${s}`}
            className={`rounded-card border-[1.5px] px-3.5 py-2 text-[13px] font-bold ${
              s === status ? 'border-blue bg-blue text-white' : 'border-line text-ink2 hover:border-blue'
            }`}
          >
            {REVIEW_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>

      <AdminTable
        columns={columns}
        rows={result.rows}
        rowActions={(row) => (
          <>
            {row.status !== 'approved' && (
              <form action={approveReviewAction.bind(null, row.id, row.listingSlug, status)}>
                <button type="submit" className="text-[14px] font-bold text-blue hover:underline">
                  Aprobar
                </button>
              </form>
            )}
            {row.status !== 'rejected' && (
              <form action={rejectReviewAction.bind(null, row.id, row.listingSlug, status)}>
                <button type="submit" className="text-[14px] font-bold text-terra hover:underline">
                  Rechazar
                </button>
              </form>
            )}
            <a
              href={listingPath(row.listingSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] font-bold text-ink2 hover:underline"
            >
              Ver ficha
            </a>
          </>
        )}
        emptyLabel={
          status === 'pending'
            ? 'No hay reseñas esperando moderación.'
            : status === 'approved'
              ? 'Todavía no publicaste ninguna reseña.'
              : 'No rechazaste ninguna reseña.'
        }
        page={result.page}
        totalPages={totalPages}
        buildPageHref={buildPageHref}
      />
    </div>
  );
}
