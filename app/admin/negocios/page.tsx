import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { currentUser } from '@/lib/auth/session';
import { parseListingListParams } from '@/lib/admin/validation';
import { recategoriseAction } from './actions';
import { listListings, LISTINGS_PAGE_SIZE, type AdminListingRow } from '@/lib/db/listings-admin';
import { listAllCategoryOptions, listAllCityOptions } from '@/lib/db/taxonomy-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Negocios' };

const COLUMNS: AdminColumn<AdminListingRow>[] = [
  {
    header: 'Negocio',
    cell: (row) => (
      <div>
        <div className="font-bold">{row.name}</div>
        <div className="font-mono text-[13px] text-ink2">{row.slug}</div>
      </div>
    ),
  },
  { header: 'Rubro', cell: (row) => row.categoriaLabel },
  { header: 'Ciudad', cell: (row) => row.ciudadLabel },
  {
    header: 'Estado',
    cell: (row) => (
      <span className="space-x-2">
        {row.premiumUntil && row.premiumUntil > Date.now() / 1000 && (
          <span className="rounded-full bg-terragold/20 px-2 py-0.5 text-[12px] font-bold text-terra">Premium</span>
        )}
        {row.featuredUntil && row.featuredUntil > Date.now() / 1000 && (
          <span className="rounded-full bg-terra/20 px-2 py-0.5 text-[12px] font-bold text-terra">Portada</span>
        )}
        {row.verified && (
          <span className="rounded-full bg-blue/10 px-2 py-0.5 text-[12px] font-bold text-blue">Verificado</span>
        )}
      </span>
    ),
  },
  {
    header: 'Actualizado',
    numeric: true,
    cell: (row) => row.updatedAt.toISOString().slice(0, 10),
  },
];

export default async function ListingsPage(
  props: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const { q, page, categoria, ciudad, estado } = parseListingListParams(searchParams);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bulkNotice = typeof searchParams.bulk === 'string' ? searchParams.bulk : undefined;

  const actor = await currentUser();
  let result;
  let categories;
  let cities;
  try {
    [result, categories, cities] = await Promise.all([
      listListings(actor, { q, page, categoria, ciudad, estado, nowSeconds }),
      listAllCategoryOptions(actor),
      listAllCityOptions(actor),
    ]);
  } catch {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(result.total / LISTINGS_PAGE_SIZE));

  const buildPageHref = (p: number) =>
    `/admin/negocios?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(categoria ? { categoria } : {}),
      ...(ciudad ? { ciudad } : {}),
      ...(estado ? { estado } : {}),
      page: String(p),
    })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-serif text-[28px] font-semibold">Negocios</h1>
        <Link
          href="/admin/negocios/nuevo"
          className="ml-auto rounded-card bg-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-blued"
        >
          Nuevo negocio
        </Link>
      </div>

      {estado && (
        <p className="text-[14px] text-ink2">
          Filtro activo: <span className="font-bold">{estado}</span> ·{' '}
          <Link href="/admin/negocios" className="text-blue hover:underline">
            Quitar
          </Link>
        </p>
      )}

      {bulkNotice && (
        <p role="status" className="rounded-card border border-line bg-white px-4 py-3 text-[14px] text-ink">
          {bulkNotice}
        </p>
      )}

      <form method="GET" className="flex flex-wrap gap-2">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscá por nombre o URL"
          aria-label="Buscar negocios"
          className="min-w-[220px] flex-1 rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        />
        <select
          name="categoria"
          defaultValue={categoria ?? ''}
          className="rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        >
          <option value="">Todos los rubros</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          name="ciudad"
          defaultValue={ciudad ?? ''}
          className="rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        >
          <option value="">Todas las ciudades</option>
          {cities.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-card border-[1.5px] border-blue px-4 py-2.5 text-sm font-bold text-blue">
          Buscar
        </button>
      </form>

      {/* The table lives inside the bulk form so the checkboxes submit with it.
          Selection is DOM-only — no client component, no state to hydrate. It
          covers the current page, which is the honest scope: a "select all
          2000 matches" that silently reaches beyond what you can see is how a
          bulk action becomes an accident (ROADMAP W2-6). */}
      <form action={recategoriseAction} className="space-y-4">
        <AdminTable
          columns={COLUMNS}
          rows={result.rows}
          editHref={(row) => `/admin/negocios/${row.id}`}
          selectable
          emptyLabel={q ? `No encontramos negocios para "${q}".` : 'Todavía no hay negocios cargados.'}
          page={result.page}
          totalPages={totalPages}
          buildPageHref={buildPageHref}
        />

        {result.rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-white px-4 py-3">
            <span className="text-[14px] font-semibold text-ink2">Con lo seleccionado:</span>
            <select
              name="bulkCategoria"
              defaultValue=""
              aria-label="Mover al rubro"
              className="rounded-card border border-line bg-white px-3 py-2 text-[15px] outline-none focus:border-blue"
            >
              <option value="">— Mover al rubro —</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-card border-[1.5px] border-blue px-4 py-2 text-sm font-bold text-blue"
            >
              Mover
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
