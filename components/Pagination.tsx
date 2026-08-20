import { Link } from '@/lib/i18n/link';
import { pageWindow } from '@/lib/pagination-window';

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

  // Windowed rather than every page (ROADMAP W3-1) — see lib/pagination-window.ts.
  const slots = pageWindow(page, totalPages);

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
      {slots.map((slot, i) =>
        slot === 'gap' ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-sm font-semibold text-ink3">
            …
          </span>
        ) : (
          <Link
            key={slot}
            href={href(slot)}
            aria-current={slot === page ? 'page' : undefined}
            className={`min-w-[36px] rounded-[10px] border px-3 py-2 text-center text-sm font-semibold ${
              slot === page ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink2 hover:text-ink'
            }`}
          >
            {slot}
          </Link>
        ),
      )}
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
