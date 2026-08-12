import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminForm, type FieldDef } from '@/components/admin/AdminForm';
import { currentAccount } from '@/lib/auth/account';
import { loginAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Ingresar' };

const LOGIN_FIELDS: FieldDef[] = [
  { type: 'email', name: 'email', label: 'Correo', required: true, maxLength: 160, autoComplete: 'username' },
  { type: 'password', name: 'password', label: 'Contraseña', required: true, autoComplete: 'current-password' },
];

export default async function LoginPage() {
  const user = await currentAccount();
  if (user) redirect(user.mustChangePassword ? '/cambiar-contrasena' : '/admin');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[24px] font-semibold">Ingresá al panel</h1>
        <p className="mt-1 text-[15px] text-ink2">Solo para el equipo de negocio.com.py.</p>
      </div>

      <AdminForm fields={LOGIN_FIELDS} action={loginAction} submitLabel="Ingresar" />

      <p className="text-[13px] text-ink2">
        ¿Perdiste tu contraseña? Pedile a un administrador que te genere una nueva — todavía no
        mandamos correos de recuperación.
      </p>
    </div>
  );
}
