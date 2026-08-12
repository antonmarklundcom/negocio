import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminForm } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { getUser } from '@/lib/db/users';
import { userFields } from '../fields';
import { resetPasswordAction, updateUserAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Cuenta' };

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  // Not-found and not-allowed are the same 404 on purpose: distinguishing them
  // would turn the URL space into an oracle for which ids exist.
  let user;
  try {
    user = await getUser(await currentUser(), id);
  } catch {
    notFound();
  }
  if (!user) notFound();

  const update = updateUserAction.bind(null, id);
  const reset = resetPasswordAction.bind(null, id);

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <Link href="/admin/usuarios" className="text-[14px] font-bold text-blue hover:underline">
          ← Usuarios
        </Link>
        <h1 className="mt-2 font-serif text-[28px] font-semibold">{user.name}</h1>
        <p className="mt-1 font-mono text-[14px] text-ink2">{user.email}</p>
      </div>

      <AdminForm
        fields={userFields('update')}
        action={update}
        submitLabel="Guardar cambios"
        defaultValues={{ ...user }}
      />

      <section className="rounded-card border border-line bg-white p-5">
        <h2 className="font-serif text-[20px] font-semibold">Contraseña</h2>
        <p className="mt-1 text-[15px] text-ink2">
          {user.hasPassword
            ? 'Generá una contraseña nueva si la persona perdió la suya. La actual deja de servir al instante.'
            : 'Esta cuenta todavía no tiene contraseña, así que no puede iniciar sesión. Generá una y pasásela.'}
        </p>
        {/* Reuses the same form component: the generated password comes back as
            a one-time notice instead of travelling in a URL. */}
        <div className="mt-4">
          <AdminForm fields={[]} action={reset} submitLabel="Generar contraseña nueva" />
        </div>
      </section>
    </div>
  );
}
