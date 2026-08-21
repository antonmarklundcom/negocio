import { SITE_NAME } from '@/lib/config';
import { RESET_TOKEN_TTL_MS } from './reset-token';

/**
 * The reset email's copy, kept out of the action so it can be asserted on in a
 * test without a mail server.
 *
 * Plain text carries the whole message (`lib/mail.ts`: every message this app
 * sends is readable without HTML), and the link appears as a bare URL rather
 * than behind anchor text — a person who has just been told their account may
 * be compromised should be able to READ where the link goes before clicking it.
 */
export function resetEmail(params: { name: string; link: string }): { subject: string; text: string } {
  const minutes = Math.round(RESET_TOKEN_TTL_MS / 60_000);
  return {
    subject: `Restablecer tu contraseña — ${SITE_NAME}`,
    text: [
      `Hola ${params.name},`,
      '',
      `Pediste restablecer tu contraseña del panel de ${SITE_NAME}. Abrí este enlace para elegir una nueva:`,
      '',
      params.link,
      '',
      `El enlace sirve una sola vez y vence en ${minutes} minutos.`,
      '',
      'Si no pediste esto, ignorá este correo: tu contraseña sigue igual y el enlace vence solo.',
    ].join('\n'),
  };
}
