'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { hashPassword, PasswordLengthError } from '@/lib/auth/password';
import { hashResetToken, resetTokenState, INVALID_RESET_TOKEN } from '@/lib/auth/reset-token';
import { parseResetPasswordInput } from '@/lib/admin/validation';
import { consumeResetToken, findResetToken, ResetTokenSpentError } from '@/lib/db/password-reset';
import { dbConfigured } from '@/lib/db/client';
import { rateLimit } from '@/lib/rate-limit';

/**
 * "Here is my new password."
 *
 * ONE MESSAGE FOR EVERY BAD TOKEN — expired, already used, never existed,
 * belongs to a suspended account. `resetTokenState` distinguishes them for the
 * server log; the response must not, because "that link was already used" tells
 * whoever is holding a stolen link that it was a real one.
 *
 * The token is re-checked HERE rather than trusted from the page that rendered
 * the form: a server action is reachable over HTTP on its own, so the page
 * having decided the token was fine a minute ago authorises nothing.
 */

const RESET_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

export async function resetPasswordAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  if (!dbConfigured()) {
    console.error('[auth] password reset submitted without DATABASE_URL configured');
    return { formError: 'El panel no está disponible en este momento.' };
  }

  const ip = await clientIp();
  if (!rateLimit(`reset-submit:${ip}`, RESET_RATE_LIMIT).ok) {
    return { formError: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' };
  }

  const parsed = parseResetPasswordInput(fd);
  if (!parsed.ok) {
    return Object.keys(parsed.errors).length > 0 ? { errors: parsed.errors } : { formError: INVALID_RESET_TOKEN };
  }

  try {
    const stored = await findResetToken(hashResetToken(parsed.data.token));
    const state = resetTokenState(stored, new Date());
    if (!stored || state !== 'valid') {
      console.warn(`[auth] password reset with a ${state} token from ${ip}`);
      return { formError: INVALID_RESET_TOKEN };
    }
    // Checked after the token, not before: a suspended account's token is
    // indistinguishable from any other dead link, which is the point.
    if (stored.status !== 'active') {
      console.warn(`[auth] password reset for suspended user ${stored.userId} from ${ip}`);
      return { formError: INVALID_RESET_TOKEN };
    }

    await consumeResetToken(stored.id, stored.userId, await hashPassword(parsed.data.next));
  } catch (err) {
    if (err instanceof PasswordLengthError) return { errors: { next: err.message } };
    // Lost the race against another request carrying the same link. The winner
    // set a password; this one did nothing, and says so in the one message.
    if (err instanceof ResetTokenSpentError) return { formError: INVALID_RESET_TOKEN };
    console.error('[auth] password reset failed:', err);
    return { formError: 'No pudimos cambiar tu contraseña. Intentá de nuevo.' };
  }

  /**
   * Deliberately NOT signed in afterwards.
   *
   * Minting a session here would mean an email link is enough to be inside the
   * panel, which quietly turns the mailbox into the credential. Making them
   * type the password they just chose costs one screen and proves they know
   * it — and if the reset was someone else's doing, that person now has to get
   * past a sign-in page too.
   */
  redirect('/ingresar?reset=1');
}
