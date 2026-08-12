'use server';

import { redirect } from 'next/navigation';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { currentUser, startSession } from '@/lib/auth/session';
import { isAuthError } from '@/lib/auth/roles';
import { hashPassword, verifyPassword, PasswordLengthError } from '@/lib/auth/password';
import { parsePasswordChangeInput } from '@/lib/admin/validation';
import { changeOwnPassword, findAccountById } from '@/lib/db/users';

/**
 * The forced-password-change loop. This is what makes the bootstrap credential
 * (and every admin-issued reset) worth exactly one sign-in.
 *
 * It RE-AUTHENTICATES with the current password before changing anything: a
 * session cookie proves who you are, not that whoever is holding the keyboard
 * right now knows the password.
 */
export async function changePasswordAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const session = await currentUser();
  if (!session) redirect('/ingresar');

  const parsed = parsePasswordChangeInput(fd);
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    const account = await findAccountById(session.id);
    if (!account || !account.passwordHash) return { formError: 'Tu cuenta no tiene una contraseña configurada.' };

    const correct = await verifyPassword(parsed.data.current, account.passwordHash);
    if (!correct) return { errors: { current: 'Esa no es tu contraseña actual.' } };

    await changeOwnPassword(session, await hashPassword(parsed.data.next));

    // Re-issue the cookie so the flag clears without waiting for a new sign-in.
    await startSession({ ...session, mustChangePassword: false });
  } catch (err) {
    if (err instanceof PasswordLengthError) return { errors: { next: err.message } };
    if (isAuthError(err)) return { formError: err.message };
    console.error('[auth] password change failed:', err);
    return { formError: 'No pudimos cambiar tu contraseña. Intentá de nuevo.' };
  }

  redirect('/admin');
}
