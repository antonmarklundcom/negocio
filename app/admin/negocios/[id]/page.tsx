import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { hasRole } from '@/lib/auth/roles';
import { getCategories, getCities } from '@/lib/listings-repo';
import { getListingForEdit } from '@/lib/db/listings-admin';
import { listingFields } from '../fields';
import { deleteListingAction, updateListingAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Negocio' };

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const actor = await currentUser();

  // Not-found and not-allowed are the same 404 on purpose (ROADMAP rule 5).
  let listing;
  try {
    listing = await getListingForEdit(actor, params.id);
  } catch {
    notFound();
  }
  if (!listing) notFound();

  const [categories, cities] = await Promise.all([getCategories(), getCities()]);
  const update = updateListingAction.bind(null, params.id);
  const remove = deleteListingAction.bind(null, params.id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href="/admin/negocios" className="text-[14px] font-bold text-blue hover:underline">
          ← Negocios
        </Link>
        <h1 className="mt-2 font-serif text-[28px] font-semibold">{listing.name}</h1>
        <p className="mt-1 font-mono text-[14px] text-ink2">/lugar/{listing.slug}</p>
      </div>

      <AdminForm
        fields={listingFields(
          'update',
          categories.map((c) => ({ value: c.slug, label: c.label })),
          cities.map((c) => ({ value: c.slug, label: c.label })),
        )}
        action={update}
        submitLabel="Guardar cambios"
        defaultValues={{ ...listing }}
      />

      {hasRole(actor, ['admin']) && (
        <section className="rounded-card border border-terra bg-terra/5 p-5">
          <h2 className="font-serif text-[20px] font-semibold">Eliminar negocio</h2>
          <p className="mt-1 text-[15px] text-ink2">
            Borra el negocio y todo lo que depende de él (horarios, galería). No se puede deshacer.
          </p>
          <form action={remove} className="mt-4">
            <button type="submit" className="rounded-card bg-terra px-4 py-2.5 text-sm font-bold text-white">
              Eliminar negocio
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
