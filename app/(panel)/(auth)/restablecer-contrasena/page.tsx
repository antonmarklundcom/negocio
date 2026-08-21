import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminForm, type FieldDef } from '@/components/admin/AdminForm';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';
import { hashResetToken, resetTokenState, INVALID_RESET_TOKEN } from '@/lib/auth/reset-token';
import { findResetToken } from '@/lib/db/password-reset';
import { dbConfigured } from '@/lib/db/client';
import { resetPasswordAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Elegir contraseña' };

const FIELDS: FieldDef[] = [
  {
    type: 'password',
    name: 'next',
    label: 'Contraseña nueva',
    required: true,
    autoComplete: 'new-password',
    hint: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`,
  },
  { type: 'password', name: 'repeat', label: 'Repetí la contraseña', required: true, autoComplete: 'new-password' },
];

/**
 * The token is checked here only to decide whether to RENDER the form — the
 * action re-checks it before writing anything. A page guard is a courtesy to
 * the person, not a security boundary: a server action is reachable on its own.
 */
export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;

  let usable = false;
  let name: string | null = null;
  if (token && dbConfigured()) {
    const stored = await findResetToken(hashResetToken(token));
    if (stored && stored.status === 'active' && resetTokenState(stored, new Date()) === 'valid') {
      usable = true;
      name = stored.name;
    }
  }

  if (!usable) {
    return (
      <div className="space-y-5">
        <h1 className="font-serif text-[24px] font-semibold">Enlace vencido</h1>
        <p className="text-[15px] text-ink2">{INVALID_RESET_TOKEN}</p>
        <p className="text-[13px] text-ink2">
          <Link href="/recuperar-contrasena" className="underline">
            Pedir un enlace nuevo
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[24px] font-semibold">Elegí tu contraseña</h1>
        <p className="mt-1 text-[15px] text-ink2">
          Hola {name}. Elegí una contraseña nueva para tu cuenta.
        </p>
      </div>

      <AdminForm fields={FIELDS} action={resetPasswordAction} submitLabel="Guardar contraseña">
        {/*
          The token travels with the submission rather than being re-read from
          the URL by the action: a server action has no URL of its own.
        */}
        <input type="hidden" name="token" value={token} />
      </AdminForm>
    </div>
  );
}
