import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/roles';
import { getCategories, getCities } from '@/lib/listings-repo';
import { listingFields } from '../fields';
import { createListingAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Nuevo negocio' };

export default async function NewListingPage() {
  try {
    requireRole(await currentUser(), ['admin', 'editor']);
  } catch {
    notFound();
  }

  const [categories, cities] = await Promise.all([getCategories(), getCities()]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/negocios" className="text-[14px] font-bold text-blue hover:underline">
          ← Negocios
        </Link>
        <h1 className="mt-2 font-serif text-[28px] font-semibold">Nuevo negocio</h1>
      </div>

      <AdminForm
        fields={listingFields(
          'create',
          categories.map((c) => ({ value: c.slug, label: c.label })),
          cities.map((c) => ({ value: c.slug, label: c.label })),
        )}
        action={createListingAction}
        submitLabel="Crear negocio"
      />
    </div>
  );
}
