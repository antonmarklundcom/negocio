import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/roles';
import { listAllCategoryOptions, listAllCityOptions } from '@/lib/db/taxonomy-admin';
import { listingFields } from '../fields';
import { createListingAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Nuevo negocio' };

export default async function NewListingPage() {
  const actor = await currentUser();
  try {
    requireRole(actor, ['admin', 'editor']);
  } catch {
    notFound();
  }

  const [categories, cities] = await Promise.all([
    listAllCategoryOptions(actor),
    listAllCityOptions(actor),
  ]);

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
          categories,
          cities,
        )}
        action={createListingAction}
        submitLabel="Crear negocio"
      />
    </div>
  );
}
