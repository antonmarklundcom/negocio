import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { hasRole } from '@/lib/auth/roles';
import { CATEGORY_ICON_KEYS } from '@/components/icons';
import { getCategory } from '@/lib/db/taxonomy-admin';
import { categoryFields } from '../fields';
import { deleteCategoryAction, updateCategoryAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Rubro' };

export default async function EditCategoryPage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const actor = await currentUser();

  let category;
  try {
    category = await getCategory(actor, params.slug);
  } catch {
    notFound();
  }
  if (!category) notFound();

  const iconOptions = CATEGORY_ICON_KEYS.map((k) => ({ value: k, label: k }));
  const update = updateCategoryAction.bind(null, params.slug);
  const remove = deleteCategoryAction.bind(null, params.slug);
  const deleteError = typeof searchParams.deleteError === 'string' ? searchParams.deleteError : undefined;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <Link href="/admin/rubros" className="text-[14px] font-bold text-blue hover:underline">
          ← Rubros
        </Link>
        <h1 className="mt-2 font-serif text-[28px] font-semibold">{category.label}</h1>
        <p className="mt-1 font-mono text-[14px] text-ink2">/{category.slug}</p>
      </div>

      <AdminForm
        fields={categoryFields('update', iconOptions)}
        action={update}
        submitLabel="Guardar cambios"
        defaultValues={{ ...category }}
      />

      {hasRole(actor, ['admin']) && (
        <section className="rounded-card border border-terra bg-terra/5 p-5">
          <h2 className="font-serif text-[20px] font-semibold">Eliminar rubro</h2>
          {deleteError && (
            <p role="alert" className="mt-2 text-[14px] font-medium text-terra">
              {deleteError}
            </p>
          )}
          <p className="mt-1 text-[15px] text-ink2">
            Solo se puede borrar un rubro sin negocios asignados. Moveé los negocios a otro rubro primero.
          </p>
          <form action={remove} className="mt-4">
            <button type="submit" className="rounded-card bg-terra px-4 py-2.5 text-sm font-bold text-white">
              Eliminar rubro
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
