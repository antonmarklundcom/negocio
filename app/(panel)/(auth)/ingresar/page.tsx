import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminForm, type FieldDef } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { loginAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Ingresar' };

const LOGIN_FIELDS: FieldDef[] = [
  { type: 'email', name: 'email', label: 'Correo', required: true, maxLength: 160, autoComplete: 'username' },
  { type: 'password', name: 'password', label: 'Contraseña', required: true, autoComplete: 'current-password' },
];

export default async function LoginPage(props: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect(user.mustChangePassword ? '/cambiar-contrasena' : '/admin');

  // Set by the reset flow, which deliberately does NOT sign you in — an email
  // link should not be a session. The banner is why the page looks like a
  // dead end otherwise: you just chose a password, now use it.
  const { reset } = await props.searchParams;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[24px] font-semibold">Ingresá al panel</h1>
        <p className="mt-1 text-[15px] text-ink2">Solo para el equipo de negocio.com.py.</p>
      </div>

      {reset === '1' && (
        <p className="rounded-card border border-line bg-cream px-3 py-2 text-[14px] text-ink2">
          Listo, cambiamos tu contraseña. Ingresá con la nueva.
        </p>
      )}

      <AdminForm fields={LOGIN_FIELDS} action={loginAction} submitLabel="Ingresar" />

      <p className="text-[13px] text-ink2">
        <Link href="/recuperar-contrasena" className="underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </div>
  );
}
