import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser } from '@/lib/auth/session';
import { hasRole } from '@/lib/auth/roles';
import { getListings, getCategories, getCities } from '@/lib/listings-repo';
import { recentActivity } from '@/lib/db/activity-log';
import { countLeadsSince } from '@/lib/db/leads-admin';
import { ACTION_LABELS } from '@/lib/admin/labels';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Panel' };

/**
 * The dashboard. Listing/category/city counts come through
 * `lib/listings-repo` — the same seam every public page reads through — so
 * the admin can never drift from what visitors actually see.
 */
export default async function AdminHome() {
  const user = await currentUser();
  const isAdmin = hasRole(user, ['admin']);

  const [listings, categories, cities] = await Promise.all([
    getListings({ page: 1, pageSize: 1 }),
    getCategories(),
    getCities(),
  ]);
  const activity = isAdmin ? await recentActivity(user, 10) : [];
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const leadsThisMonth = isAdmin ? await countLeadsSince(user, startOfMonth) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-[28px] font-semibold">Panel</h1>
        <p className="mt-1 text-[15px] text-ink2">
          Desde acá administrás el contenido de negocio.com.py.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Negocios publicados" value={listings.total} />
        <Stat label="Rubros" value={categories.length} />
        <Stat label="Ciudades" value={cities.length} />
        {leadsThisMonth !== null && <Stat label="Leads este mes" value={leadsThisMonth} />}
      </div>

      <section className="rounded-card border border-line bg-white p-5">
        <h2 className="font-serif text-[20px] font-semibold">Qué podés hacer hoy</h2>
        <ul className="mt-3 space-y-2 text-[15px]">
          <li>
            <Link href="/admin/negocios" className="font-bold text-blue hover:underline">
              Negocios
            </Link>{' '}
            — cargá y editá las fichas de negocios.
          </li>
          <li>
            <Link href="/admin/rubros" className="font-bold text-blue hover:underline">
              Rubros
            </Link>{' '}
            y{' '}
            <Link href="/admin/ciudades" className="font-bold text-blue hover:underline">
              ciudades
            </Link>{' '}
            — administrá la taxonomía curada del sitio.
          </li>
          {isAdmin && (
            <li>
              <Link href="/admin/leads" className="font-bold text-blue hover:underline">
                Leads
              </Link>{' '}
              — revisá los contactos que llegaron por el sitio.
            </li>
          )}
          {isAdmin && (
            <li>
              <Link href="/admin/usuarios" className="font-bold text-blue hover:underline">
                Usuarios
              </Link>{' '}
              — creá y administrá las cuentas del equipo.
            </li>
          )}
        </ul>
      </section>

      {isAdmin && (
        <section>
          <h2 className="font-serif text-[20px] font-semibold">Actividad reciente</h2>
          {activity.length === 0 ? (
            <p className="mt-3 rounded-card border border-line bg-white px-4 py-6 text-center text-[15px] text-ink2">
              Todavía no hay cambios registrados. Cada modificación que hagas desde el panel queda acá.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-white">
              {activity.map((entry) => (
                <li key={entry.id} className="flex flex-wrap gap-x-2 px-4 py-3 text-[14px]">
                  <span className="font-bold">{entry.actorName ?? 'Cuenta eliminada'}</span>
                  <span className="text-ink2">
                    {ACTION_LABELS[entry.action]} {entry.entityType}{' '}
                    <span className="font-mono text-[13px]">{entry.entityId}</span>
                  </span>
                  <time className="ml-auto font-mono text-[13px] tabular-nums text-ink2">
                    {entry.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="font-mono text-[28px] font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-[14px] text-ink2">{label}</div>
    </div>
  );
}
