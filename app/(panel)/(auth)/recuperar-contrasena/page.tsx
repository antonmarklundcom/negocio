import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminForm, type FieldDef } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { requestResetAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Recuperar contraseña' };

const FIELDS: FieldDef[] = [
  { type: 'email', name: 'email', label: 'Correo', required: true, maxLength: 160, autoComplete: 'username' },
];

export default async function RequestResetPage() {
  // Someone already signed in does not need this page; they have
  // /cambiar-contrasena, which re-verifies the current password instead of
  // mailing a link.
  const user = await currentUser();
  if (user) redirect(user.mustChangePassword ? '/cambiar-contrasena' : '/admin');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[24px] font-semibold">Recuperar contraseña</h1>
        <p className="mt-1 text-[15px] text-ink2">
          Escribí el correo de tu cuenta y te mandamos un enlace para elegir una contraseña nueva.
        </p>
      </div>

      <AdminForm fields={FIELDS} action={requestResetAction} submitLabel="Mandar enlace" />

      <p className="text-[13px] text-ink2">
        <Link href="/ingresar" className="underline">
          Volver a ingresar
        </Link>
      </p>
    </div>
  );
}
