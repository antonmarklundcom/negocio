import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { currentUser } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { STATUS_LABELS } from '@/lib/admin/labels';
import { parseListParams } from '@/lib/admin/validation';
import { listUsers, USERS_PAGE_SIZE, type AdminUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Usuarios' };

const COLUMNS: AdminColumn<AdminUserRow>[] = [
  { header: 'Nombre', cell: (row) => row.name },
  { header: 'Correo', cell: (row) => <span className="font-mono text-[13px]">{row.email}</span> },
  { header: 'Rol', cell: (row) => ROLE_LABELS[row.role] },
  {
    header: 'Estado',
    cell: (row) => (
      <span className={row.status === 'suspended' ? 'font-bold text-terra' : ''}>
        {STATUS_LABELS[row.status]}
        {!row.hasPassword && <span className="ml-2 text-[13px] text-ink2">(sin contraseña)</span>}
      </span>
    ),
  },
  {
    header: 'Último ingreso',
    numeric: true,
    cell: (row) => (row.lastLoginAt ? row.lastLoginAt.toISOString().slice(0, 10) : '—'),
  },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { q, page } = parseListParams(searchParams);

  // `listUsers` calls requireRole itself; an editor reaching this URL directly
  // gets the same 404 the layout would have given them.
  let result;
  try {
    result = await listUsers(await currentUser(), { q, page });
  } catch {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(result.total / USERS_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-serif text-[28px] font-semibold">Usuarios</h1>
        <Link
          href="/admin/usuarios/nuevo"
          className="ml-auto rounded-card bg-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-blued"
        >
          Nueva cuenta
        </Link>
      </div>

      {/* Search is a plain GET form — no client component, and the URL is shareable. */}
      <form method="GET" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscá por nombre o correo"
          aria-label="Buscar usuarios"
          className="min-w-[220px] flex-1 rounded-card border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        />
        <button type="submit" className="rounded-card border-[1.5px] border-blue px-4 py-2.5 text-sm font-bold text-blue">
          Buscar
        </button>
      </form>

      <AdminTable
        columns={COLUMNS}
        rows={result.rows}
        editHref={(row) => `/admin/usuarios/${row.id}`}
        emptyLabel={
          q
            ? `Ninguna cuenta coincide con “${q}”.`
            : 'Todavía no hay otras cuentas. Creá una para sumar a alguien del equipo.'
        }
        page={result.page}
        totalPages={totalPages}
        buildPageHref={(p) => `/admin/usuarios?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
      />
    </div>
  );
}
