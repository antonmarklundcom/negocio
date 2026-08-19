import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * SMTP transport (ROADMAP W2-4). Env-gated exactly like Sentry and R2: with
 * `SMTP_*` unset the app boots and serves normally and nothing here is ever
 * constructed. That is the pattern the rest of this repo uses for anything
 * that depends on an account somebody still has to create.
 *
 * This module is also the PR-6 blocker-killer. "Password reset by email" is
 * the gate on ever announcing the owner portal to a real business, and it
 * needs exactly this transport and nothing else.
 *
 * Deliberately NOT a queue and NOT a retry loop. The only sender today is a
 * weekly staff digest triggered by an external cron: if it fails, the cron
 * retries next week and nobody is blocked. Adding durable delivery before
 * there is a message a human is waiting on would be building the hard part
 * first.
 */

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain text. Every message this app sends is readable without HTML. */
  text: string;
  html?: string;
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super(
      'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and ' +
        'MAIL_FROM in the app env (Hostinger: hPanel → Node.js app → Environment variables), ' +
        'then redeploy.',
    );
    this.name = 'MailNotConfiguredError';
  }
}

export function mailConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.MAIL_FROM
  );
}

/** Where the staff digest goes. Falls back to `MAIL_FROM` — a digest nobody reads is still better than one that silently goes nowhere. */
export function staffRecipients(): string[] {
  const raw = process.env.MAIL_STAFF_TO || process.env.MAIL_FROM || '';
  return raw
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
}

let cached: Transporter | null = null;

function transport(): Transporter {
  if (!mailConfigured()) throw new MailNotConfiguredError();
  if (cached) return cached;

  const port = Number(process.env.SMTP_PORT);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 and 25 start plaintext and STARTTLS up. Getting
    // this wrong does not fail loudly — it fails as a connection that hangs.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
  });
  return cached;
}

/**
 * Send one message. Throws when SMTP is unconfigured or the send fails — the
 * caller decides what that means. The digest route turns it into a non-200 so
 * the external cron's own failure notice is the alert; a future password-reset
 * flow must NOT swallow it, because a silent failure there locks someone out.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  await transport().sendMail({
    from: process.env.MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
