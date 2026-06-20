import Link from 'next/link';

/** SSR page-based pagination (§6.2). Each page is server-rendered and indexable. */
export function Pagination({
  basePath,
  baseParams,
  page,
  totalPages,
}: {
  basePath: string;
  baseParams: Record<string, string>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const params = new URLSearchParams(baseParams);
    if (p > 1) params.set('page', String(p));
    else params.delete('page');
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Paginación">
      {page > 1 && (
        <Link
          href={href(page - 1)}
          className="rounded-[10px] border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink2 hover:text-ink"
        >
          Anterior
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? 'page' : undefined}
          className={`min-w-[36px] rounded-[10px] border px-3 py-2 text-center text-sm font-semibold ${
            p === page ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink2 hover:text-ink'
          }`}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link
          href={href(page + 1)}
          className="rounded-[10px] border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink2 hover:text-ink"
        >
          Ver más
        </Link>
      )}
    </nav>
  );
}
