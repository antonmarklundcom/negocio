'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { authenticate, normalizeEmail, LOGIN_ERROR } from '@/lib/auth/login';
import { startSession, sessionConfigured } from '@/lib/auth/session';
import { parseLoginInput } from '@/lib/admin/validation';
import { findAccountForLogin, markLoggedIn } from '@/lib/db/users';
import { dbConfigured } from '@/lib/db/client';
import { rateLimit } from '@/lib/rate-limit';

/**
 * The route's whole job: call `authenticate`, set a cookie. Every judgement
 * about whether a sign-in is allowed lives in `lib/auth/login.ts`, which is
 * testable without a request.
 *
 * Every failure returns LOGIN_ERROR — the same string for an unknown email, a
 * wrong password, an account with no password and a suspended account. The real
 * reason goes to the server log only.
 */

const LOGIN_RATE_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 };

function clientIp(): string {
  const h = headers();
  const forwarded = h.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

export async function loginAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  if (!dbConfigured() || !sessionConfigured()) {
    console.error('[auth] login attempted without DATABASE_URL or SESSION_SECRET configured');
    return { formError: 'El panel no está disponible en este momento.' };
  }

  const limit = rateLimit(`login:${clientIp()}`, LOGIN_RATE_LIMIT);
  if (!limit.ok) {
    return { formError: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' };
  }

  const parsed = parseLoginInput(fd);
  if (!parsed.ok) return { formError: LOGIN_ERROR };

  const email = normalizeEmail(parsed.data.email);

  let result;
  try {
    const account = await findAccountForLogin(email);
    result = await authenticate(account, parsed.data.password);
  } catch (err) {
    console.error('[auth] login failed unexpectedly:', err);
    return { formError: 'No pudimos verificar tus datos. Intentá de nuevo.' };
  }

  if (!result.ok) {
    console.warn(`[auth] failed login for "${email}" (${result.reason}) from ${clientIp()}`);
    return { formError: LOGIN_ERROR };
  }

  await markLoggedIn(result.user.id, result.rehashTo);
  await startSession(result.user);

  redirect(result.user.mustChangePassword ? '/cambiar-contrasena' : '/admin');
}
