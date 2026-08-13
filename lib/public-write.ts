import { rateLimit } from './rate-limit';

/**
 * The public-write equivalent of `requireRole` (ROADMAP Phase B, rule 1).
 *
 * A public form has no session to check, so the thing that must run as the
 * FIRST statement of its query-module function is this: the honeypot, then the
 * per-IP rate limit. Putting it in the route or the server action instead
 * leaves the query-module function itself reachable and unguarded — exactly
 * the failure `requireRole`-in-the-query-module exists to prevent.
 *
 * It throws rather than returning a boolean, for the same reason `requireRole`
 * does: a caller that forgets to check a returned `false` still ships.
 */

export type PublicWriteReason = 'honeypot' | 'rate_limited' | 'unknown_target';

export class PublicWriteError extends Error {
  constructor(
    message: string,
    readonly reason: PublicWriteReason,
    /** Seconds until the window resets; only meaningful for `rate_limited`. */
    readonly retryAfter = 0,
  ) {
    super(message);
    this.name = 'PublicWriteError';
  }
}

export function isPublicWriteError(err: unknown): err is PublicWriteError {
  return err instanceof PublicWriteError;
}

export interface PublicWriteContext {
  /** Best-effort client IP (`clientIp()` from `lib/rate-limit.ts`). */
  ip: string;
  /** The hidden `hp` field's submitted value. Anything truthy is a bot. */
  honeypot?: string;
  /** Rate-limit bucket prefix, e.g. `reviews`. The IP is appended here. */
  key: string;
  limit?: number;
  windowMs?: number;
}

/**
 * Honeypot first, then the rate limit: a bot that fills `hp` must not also
 * consume a real visitor's budget on a shared NAT address.
 *
 * The caller decides what a `honeypot` throw means for the visitor. Every
 * caller in this repo does what `/api/v1/leads` already does — answer as if
 * the submission succeeded and drop it — because telling a bot it was detected
 * only teaches it to stop filling the field.
 */
export function requirePublicWrite(ctx: PublicWriteContext): void {
  if (ctx.honeypot) {
    throw new PublicWriteError('Descartado.', 'honeypot');
  }
  const { ok, retryAfter } = rateLimit(`${ctx.key}:${ctx.ip}`, {
    limit: ctx.limit,
    windowMs: ctx.windowMs,
  });
  if (!ok) {
    throw new PublicWriteError('Esperá un momento antes de enviar otra vez.', 'rate_limited', retryAfter);
  }
}
