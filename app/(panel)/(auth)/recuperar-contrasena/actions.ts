'use server';

import { headers } from 'next/headers';
import type { AdminFormState } from '@/components/admin/AdminForm';
import { normalizeEmail } from '@/lib/auth/login';
import { mintResetToken, resetTokenExpiry, resetLink } from '@/lib/auth/reset-token';
import { resetEmail } from '@/lib/auth/reset-email';
import { parseResetRequestInput } from '@/lib/admin/validation';
import { createResetToken, findResetRecipient, purgeExpiredResetTokens } from '@/lib/db/password-reset';
import { dbConfigured } from '@/lib/db/client';
import { mailConfigured, sendMail } from '@/lib/mail';
import { rateLimit } from '@/lib/rate-limit';
import { SITE_URL } from '@/lib/config';

/**
 * "Send me a reset link."
 *
 * THE RESPONSE IS THE SAME WHATEVER HAPPENS: unknown email, suspended account,
 * active account, already-requested — one message. This form is reachable by
 * anyone on the internet, and a different answer for a real address turns it
 * into a directory of who works here.
 *
 * The two exceptions are deliberate and neither depends on the email typed in:
 * a rate-limit refusal, and SMTP being unconfigured or refusing the message.
 * See the note on the send below — swallowing that one locks people out.
 */

/** Per-IP: enough for a person who mistypes their address, not enough to enumerate. */
const IP_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
/**
 * Per-address, on top of the IP limit: without it, a rotating pool of IPs can
 * still flood ONE person's mailbox with reset mail. The key is the address, so
 * the ceiling follows the victim rather than the attacker.
 */
const EMAIL_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };

const SENT_MESSAGE =
  'Si esa dirección corresponde a una cuenta, te mandamos un enlace para restablecer la contraseña. Revisá tu correo.';

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

export async function requestResetAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  if (!dbConfigured()) {
    console.error('[auth] password reset requested without DATABASE_URL configured');
    return { formError: 'El panel no está disponible en este momento.' };
  }
  if (!mailConfigured()) {
    // Said plainly rather than pretending to have sent something. This state is
    // a deployment mistake, not a user error, and it is identical for every
    // address — so it enumerates nobody.
    console.error('[auth] password reset requested but SMTP is not configured');
    return { formError: 'La recuperación por correo todavía no está habilitada. Pedile una contraseña nueva a un administrador.' };
  }

  const ip = await clientIp();
  if (!rateLimit(`reset-ip:${ip}`, IP_LIMIT).ok) {
    return { formError: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' };
  }

  const parsed = parseResetRequestInput(fd);
  // Even a malformed address gets the success message: "that is not a valid
  // email" is fine to say, but saying it ONLY for invalid ones would make the
  // silence for valid-but-unknown ones meaningful.
  if (!parsed.ok) return { notice: SENT_MESSAGE };

  const email = normalizeEmail(parsed.data.email);
  if (!rateLimit(`reset-email:${email}`, EMAIL_LIMIT).ok) {
    return { notice: SENT_MESSAGE };
  }

  try {
    const recipient = await findResetRecipient(email);

    // Suspended accounts are refused in silence. Telling the holder of a
    // disabled account that it is disabled is itself a fact about staffing.
    if (!recipient || recipient.status !== 'active') {
      console.warn(`[auth] password reset for a ${recipient ? 'suspended' : 'unknown'} address from ${ip}`);
      return { notice: SENT_MESSAGE };
    }

    const now = new Date();
    const { token, tokenHash } = mintResetToken();
    await createResetToken(recipient.id, tokenHash, resetTokenExpiry(now));

    const { subject, text } = resetEmail({
      name: recipient.name,
      link: resetLink(SITE_URL, token),
    });
    await sendMail({ to: recipient.email, subject, text });

    // Opportunistic housekeeping, after the part the person is waiting on.
    // A failure here is not their problem, so it must not become their error.
    void purgeExpiredResetTokens(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).catch((err) => {
      console.error('[auth] purging expired reset tokens failed:', err);
    });
  } catch (err) {
    /**
     * NOT swallowed, deliberately (`lib/mail.ts` says so in as many words: a
     * silent failure here locks someone out). The cost is a narrow oracle —
     * an address that exists can produce a send failure where an unknown one
     * cannot — and that trade is made knowingly: the alternative is a person
     * staring at "check your email" for an email that was never sent and never
     * will be.
     */
    console.error('[auth] password reset failed:', err);
    return { formError: 'No pudimos mandar el correo. Intentá de nuevo en un rato.' };
  }

  return { notice: SENT_MESSAGE };
}
