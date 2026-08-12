import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/roles';
import { userFields } from '../fields';
import { createUserAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Nueva cuenta' };

export default async function NewUserPage() {
  try {
    requireRole(await currentUser(), ['admin']);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/admin/usuarios" className="text-[14px] font-bold text-blue hover:underline">
          ← Usuarios
        </Link>
        <h1 className="mt-2 font-serif text-[28px] font-semibold">Nueva cuenta</h1>
        <p className="mt-1 text-[15px] text-ink2">
          La cuenta se crea sin contraseña. Después de guardarla, generá una desde su ficha y pasásela
          a la persona — al iniciar sesión va a tener que cambiarla.
        </p>
      </div>

      <AdminForm fields={userFields('create')} action={createUserAction} submitLabel="Crear cuenta" />
    </div>
  );
}
