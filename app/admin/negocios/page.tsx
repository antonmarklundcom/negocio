import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { currentUser } from '@/lib/auth/session';
import { parseListingListParams } from '@/lib/admin/validation';
import { listListings, LISTINGS_PAGE_SIZE, type AdminListingRow } from '@/lib/db/listings-admin';
import { getCategories, getCities } from '@/lib/listings-repo';

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

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { q, page, categoria, ciudad } = parseListingListParams(searchParams);

  let result;
  let categories;
  let cities;
  try {
    [result, categories, cities] = await Promise.all([
      listListings(await currentUser(), { q, page, categoria, ciudad }),
      getCategories(),
      getCities(),
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

      <form method="GET" className="flex flex-wrap gap-2">
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
            <option key={c.slug} value={c.slug}>
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
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-card border-[1.5px] border-blue px-4 py-2.5 text-sm font-bold text-blue">
          Buscar
        </button>
      </form>

      <AdminTable
        columns={COLUMNS}
        rows={result.rows}
        editHref={(row) => `/admin/negocios/${row.id}`}
        emptyLabel={q ? `No encontramos negocios para "${q}".` : 'Todavía no hay negocios cargados.'}
        page={result.page}
        totalPages={totalPages}
        buildPageHref={buildPageHref}
      />
    </div>
  );
}
