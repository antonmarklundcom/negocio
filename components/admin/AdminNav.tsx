import Link from 'next/link';
import type { SessionUser } from '@/lib/auth/session';
import { hasRole } from '@/lib/auth/roles';
import { logoutAction } from '@/app/admin/actions';

/**
 * A plain `<ul>` of `<a>`. No active-state JS, no client component — the cost of
 * highlighting the current link is not worth shipping a bundle to the admin.
 *
 * Hiding the "Usuarios" link from an editor is UX, NOT access control: the
 * guard that matters is `requireRole` inside `lib/db/users.ts`.
 */
export function AdminNav({ user }: { user: SessionUser }) {
  const isAdmin = hasRole(user, ['admin']);
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-8">
        <Link href="/admin" className="font-serif text-[19px] font-semibold">
          negocio<span className="text-terra">.admin</span>
        </Link>
        <nav>
          <ul className="flex flex-wrap items-center gap-4 text-[14px] font-medium">
            <li>
              <Link href="/admin" className="hover:text-blue">
                Inicio
              </Link>
            </li>
            <li>
              <Link href="/admin/negocios" className="hover:text-blue">
                Negocios
              </Link>
            </li>
            <li>
              <Link href="/admin/rubros" className="hover:text-blue">
                Rubros
              </Link>
            </li>
            <li>
              <Link href="/admin/ciudades" className="hover:text-blue">
                Ciudades
              </Link>
            </li>
            {/* Hidden from editors is UX, not access control — `listLeads`'s own
                guard is what actually stops them. */}
            {isAdmin && (
              <li>
                <Link href="/admin/leads" className="hover:text-blue">
                  Leads
                </Link>
              </li>
            )}
            {isAdmin && (
              <li>
                <Link href="/admin/usuarios" className="hover:text-blue">
                  Usuarios
                </Link>
              </li>
            )}
            <li>
              <Link href="/" className="hover:text-blue">
                Ver el sitio
              </Link>
            </li>
          </ul>
        </nav>
        <form action={logoutAction} className="ml-auto">
          <button type="submit" className="text-[14px] font-bold text-ink2 hover:text-terra">
            Cerrar sesión
          </button>
        </form>
      </div>
    </header>
  );
}
