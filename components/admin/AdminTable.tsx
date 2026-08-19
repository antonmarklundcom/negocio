import Link from 'next/link';

/**
 * The ONE table component for the whole admin. A new entity gains a list page
 * by writing a column list, not a table.
 *
 * A server component: pagination is a link and search is a `<form method="GET">`,
 * so there is no client state to hold and nothing to hydrate.
 */

export interface AdminColumn<Row> {
  header: string;
  cell: (row: Row) => React.ReactNode;
  /** Numeric columns render monospace so digits line up down the column. */
  numeric?: boolean;
}

export interface AdminTableProps<Row extends { id: number | string }> {
  columns: AdminColumn<Row>[];
  rows: Row[];
  /**
   * Omitted by entities that have no edit page. A row whose only action is
   * "approve" or "reject" must not render an "Editar" link that goes nowhere.
   */
  editHref?: (row: Row) => string;
  /**
   * Extra per-row controls (server-action `<form>`s), rendered in the same
   * "Acciones" cell. With neither this nor `editHref`, the column is not
   * rendered at all.
   */
  rowActions?: (row: Row) => React.ReactNode;
  /**
   * Renders a leading checkbox column named `selected` (ROADMAP W2-6). The
   * caller is responsible for wrapping the table in the `<form>` that submits
   * them — this component stays a plain server component with no state, and
   * the selection lives entirely in the DOM.
   */
  selectable?: boolean;
  /** Honest, context-specific copy — never "No results". */
  emptyLabel: string;
  page: number;
  totalPages: number;
  buildPageHref: (page: number) => string;
}

export function AdminTable<Row extends { id: number | string }>({
  columns,
  rows,
  editHref,
  rowActions,
  selectable = false,
  emptyLabel,
  page,
  totalPages,
  buildPageHref,
}: AdminTableProps<Row>) {
  const hasActions = !!editHref || !!rowActions;

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-white px-4 py-8 text-center text-[15px] text-ink2">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-line bg-cream/60">
              {selectable && <th className="w-10 px-4 py-3" aria-label="Seleccionar" />}
              {columns.map((col) => (
                <th key={col.header} className="px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-ink2">
                  {col.header}
                </th>
              ))}
              {hasActions && (
                <th className="px-4 py-3 text-right text-[12px] font-bold uppercase tracking-wide text-ink2">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-b border-line last:border-b-0">
                {selectable && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      name="selected"
                      value={String(row.id)}
                      aria-label={`Seleccionar ${String(row.id)}`}
                      className="h-4 w-4 accent-blue"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`px-4 py-3 align-middle ${col.numeric ? 'font-mono tabular-nums' : ''}`}
                  >
                    {col.cell(row)}
                  </td>
                ))}
                {hasActions && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {rowActions?.(row)}
                      {editHref && (
                        <Link href={editHref(row)} className="text-[14px] font-bold text-blue hover:underline">
                          Editar
                        </Link>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-[14px]" aria-label="Paginación">
          {page > 1 ? (
            <Link href={buildPageHref(page - 1)} className="font-bold text-blue hover:underline">
              ← Anterior
            </Link>
          ) : (
            <span className="text-ink2">← Anterior</span>
          )}
          <span className="text-ink2">
            Página <span className="font-mono tabular-nums">{page}</span> de{' '}
            <span className="font-mono tabular-nums">{totalPages}</span>
          </span>
          {page < totalPages ? (
            <Link href={buildPageHref(page + 1)} className="font-bold text-blue hover:underline">
              Siguiente →
            </Link>
          ) : (
            <span className="text-ink2">Siguiente →</span>
          )}
        </nav>
      )}
    </div>
  );
}
