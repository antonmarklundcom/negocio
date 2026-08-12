import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/roles';
import { cityFields } from '../fields';
import { createCityAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Nueva ciudad' };

export default async function NewCityPage() {
  try {
    requireRole(await currentUser(), ['admin', 'editor']);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/admin/ciudades" className="text-[14px] font-bold text-blue hover:underline">
          ← Ciudades
        </Link>
        <h1 className="mt-2 font-serif text-[28px] font-semibold">Nueva ciudad</h1>
      </div>

      <AdminForm fields={cityFields('create')} action={createCityAction} submitLabel="Crear ciudad" />
    </div>
  );
}
