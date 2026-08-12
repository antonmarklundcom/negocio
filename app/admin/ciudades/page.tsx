import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { currentUser } from '@/lib/auth/session';
import { parseListParams } from '@/lib/admin/validation';
import {
  countListingsByCity,
  listCities,
  TAXONOMY_PAGE_SIZE,
  type AdminCityRow,
} from '@/lib/db/taxonomy-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Ciudades' };

type Row = AdminCityRow & { id: string; negocios: number };

export default async function CitiesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { q, page } = parseListParams(searchParams);
  const actor = await currentUser();

  let result;
  let counts: Record<string, number>;
  try {
    [result, counts] = await Promise.all([listCities(actor, { q, page }), countListingsByCity(actor)]);
  } catch {
    notFound();
  }

  const rows: Row[] = result.rows.map((r) => ({ ...r, id: r.slug, negocios: counts[r.slug] ?? 0 }));
  const totalPages = Math.max(1, Math.ceil(result.total / TAXONOMY_PAGE_SIZE));

  const COLUMNS: AdminColumn<Row>[] = [
    {
      header: 'Ciudad',
      cell: (row) => (
        <div>
          <div className="font-bold">{row.label}</div>
          <div className="font-mono text-[13px] text-ink2">{row.slug}</div>
        </div>
      ),
    },
    { header: 'Orden', numeric: true, cell: (row) => row.sortOrder },
    { header: 'Coordenadas', numeric: true, cell: (row) => (row.lat && row.lng ? `${row.lat}, ${row.lng}` : '—') },
    { header: 'Negocios', numeric: true, cell: (row) => row.negocios },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-serif text-[28px] font-semibold">Ciudades</h1>
        <Link
          href="/admin/ciudades/nuevo"
          className="ml-auto rounded-card bg-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-blued"
        >
          Nueva ciudad
        </Link>
      </div>

      <form method="GET" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscá por etiqueta"
          aria-label="Buscar ciudades"
          className="min-w-[220px] flex-1 rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        />
        <button type="submit" className="rounded-card border-[1.5px] border-blue px-4 py-2.5 text-sm font-bold text-blue">
          Buscar
        </button>
      </form>

      <AdminTable
        columns={COLUMNS}
        rows={rows}
        editHref={(row) => `/admin/ciudades/${row.slug}`}
        emptyLabel={q ? `No encontramos ciudades para "${q}".` : 'Todavía no hay ciudades cargadas.'}
        page={result.page}
        totalPages={totalPages}
        buildPageHref={(p) => `/admin/ciudades?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
      />
    </div>
  );
}
