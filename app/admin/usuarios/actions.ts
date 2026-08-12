'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { currentUser } from '@/lib/auth/session';
import { isAuthError } from '@/lib/auth/roles';
import { generatePassword } from '@/lib/auth/password';
import { parseUserInput } from '@/lib/admin/validation';
import { createUser, isEmailTaken, resetUserPassword, updateUser } from '@/lib/db/users';

/**
 * Server actions: parse, call the query module, revalidate, redirect.
 *
 * These do NOT call `requireRole` in place of the query module doing it. The
 * query module guards; this layer only turns thrown errors into a message the
 * form can render.
 */

function messageFor(err: unknown): string {
  if (isAuthError(err)) return err.message;
  console.error('[admin/usuarios] action failed:', err);
  return 'No pudimos guardar los cambios. Intentá de nuevo.';
}

export async function createUserAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseUserInput(fd, 'create');
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    if (await isEmailTaken(actor, parsed.data.email, null)) {
      return { errors: { email: 'Ya existe una cuenta con ese correo.' } };
    }
    await createUser(actor, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath('/admin/usuarios');
  redirect('/admin/usuarios');
}

export async function updateUserAction(id: number, _prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await currentUser();

  const parsed = parseUserInput(fd, 'update');
  if (!parsed.ok) return { errors: parsed.errors };

  try {
    if (await isEmailTaken(actor, parsed.data.email, id)) {
      return { errors: { email: 'Ya existe una cuenta con ese correo.' } };
    }
    await updateUser(actor, id, parsed.data);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath('/admin/usuarios');
  redirect('/admin/usuarios');
}

/**
 * Issues a new random password and returns it in the form state so it renders
 * exactly once, on the page that asked for it.
 *
 * Deliberately NOT a redirect carrying the password in a query string: a URL
 * ends up in the server access log, the browser history and any `Referer`
 * header the next request sends. The plaintext is never stored and never
 * logged; if the admin loses it, they issue another one.
 */
export async function resetPasswordAction(
  id: number,
  _prev: AdminFormState,
  _fd: FormData,
): Promise<AdminFormState> {
  const actor = await currentUser();

  const plaintext = generatePassword();
  try {
    await resetUserPassword(actor, id, plaintext);
  } catch (err) {
    return { formError: messageFor(err) };
  }

  revalidatePath(`/admin/usuarios/${id}`);
  return {
    notice:
      `Contraseña nueva: ${plaintext} — copiala ahora, no se vuelve a mostrar. ` +
      'La persona tiene que cambiarla al iniciar sesión.',
  };
}
