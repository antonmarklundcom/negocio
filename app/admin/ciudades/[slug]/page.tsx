import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { hasRole } from '@/lib/auth/roles';
import { getCityAdmin } from '@/lib/db/taxonomy-admin';
import { cityFields } from '../fields';
import { deleteCityAction, updateCityAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Ciudad' };

export default async function EditCityPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await currentUser();

  let city;
  try {
    city = await getCityAdmin(actor, params.slug);
  } catch {
    notFound();
  }
  if (!city) notFound();

  const update = updateCityAction.bind(null, params.slug);
  const remove = deleteCityAction.bind(null, params.slug);
  const deleteError = typeof searchParams.deleteError === 'string' ? searchParams.deleteError : undefined;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <Link href="/admin/ciudades" className="text-[14px] font-bold text-blue hover:underline">
          ← Ciudades
        </Link>
        <h1 className="mt-2 font-serif text-[28px] font-semibold">{city.label}</h1>
        <p className="mt-1 font-mono text-[14px] text-ink2">/{city.slug}</p>
      </div>

      <AdminForm fields={cityFields('update')} action={update} submitLabel="Guardar cambios" defaultValues={{ ...city }} />

      {hasRole(actor, ['admin']) && (
        <section className="rounded-card border border-terra bg-terra/5 p-5">
          <h2 className="font-serif text-[20px] font-semibold">Eliminar ciudad</h2>
          {deleteError && (
            <p role="alert" className="mt-2 text-[14px] font-medium text-terra">
              {deleteError}
            </p>
          )}
          <p className="mt-1 text-[15px] text-ink2">
            Solo se puede borrar una ciudad sin negocios asignados. Moveé los negocios a otra ciudad primero.
          </p>
          <form action={remove} className="mt-4">
            <button type="submit" className="rounded-card bg-terra px-4 py-2.5 text-sm font-bold text-white">
              Eliminar ciudad
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
