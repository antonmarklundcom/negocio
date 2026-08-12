import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminForm, type FieldDef } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';
import { changePasswordAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Cambiar contraseña' };

const FIELDS: FieldDef[] = [
  { type: 'password', name: 'current', label: 'Contraseña actual', required: true, autoComplete: 'current-password' },
  {
    type: 'password',
    name: 'next',
    label: 'Contraseña nueva',
    required: true,
    autoComplete: 'new-password',
    hint: `Al menos ${MIN_PASSWORD_LENGTH} caracteres. Usá una frase larga que solo vos sepas.`,
  },
  { type: 'password', name: 'repeat', label: 'Repetí la nueva', required: true, autoComplete: 'new-password' },
];

export default async function ChangePasswordPage() {
  const user = await currentUser();
  if (!user) redirect('/ingresar');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[24px] font-semibold">Cambiá tu contraseña</h1>
        <p className="mt-1 text-[15px] text-ink2">
          {user.mustChangePassword
            ? 'Antes de entrar al panel, elegí una contraseña propia. La que te pasaron sirve una sola vez.'
            : 'Elegí una contraseña nueva.'}
        </p>
      </div>

      <AdminForm fields={FIELDS} action={changePasswordAction} submitLabel="Guardar contraseña" />
    </div>
  );
}
