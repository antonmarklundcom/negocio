import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentUser, type SessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/roles';
import { dbConfigured } from '@/lib/db/client';
import { AdminNav } from '@/components/admin/AdminNav';

/**
 * A session is per-request. Without this the whole admin could be statically
 * rendered at build time and any guard added below would never run — that
 * exact bug shipped on the reference implementation.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * THIS GUARD IS A BACKSTOP, NOT THE BOUNDARY.
 *
 * A server action is reachable over HTTP without this layout ever rendering,
 * and Next.js does not re-run a layout for one. The real boundary is
 * `requireRole` as the first statement of every function in `lib/db/*`.
 *
 * Unauthorised visitors get a 404, never a 403: "this exists but you may not
 * see it" is itself information.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The admin reads and writes users; with no database there is nothing to
  // sign in against. Local dev on seed data has no admin at all, by design.
  if (!dbConfigured()) notFound();

  let session: SessionUser;
  try {
    session = requireRole(await currentUser(), ['editor']);
  } catch {
    notFound();
  }

  if (session.mustChangePassword) redirect('/cambiar-contrasena');

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav user={session} />
      <div className="mx-auto max-w-content px-4 py-8 md:px-8">{children}</div>
    </div>
  );
}
