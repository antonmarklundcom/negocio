import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/roles';
import { CATEGORY_ICON_KEYS } from '@/components/icons';
import { categoryFields } from '../fields';
import { createCategoryAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Nuevo rubro' };

export default async function NewCategoryPage() {
  try {
    requireRole(await currentUser(), ['admin', 'editor']);
  } catch {
    notFound();
  }

  const iconOptions = CATEGORY_ICON_KEYS.map((k) => ({ value: k, label: k }));

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/admin/rubros" className="text-[14px] font-bold text-blue hover:underline">
          ← Rubros
        </Link>
        <h1 className="mt-2 font-serif text-[28px] font-semibold">Nuevo rubro</h1>
      </div>

      <AdminForm fields={categoryFields('create', iconOptions)} action={createCategoryAction} submitLabel="Crear rubro" />
    </div>
  );
}
