import * as Sentry from '@sentry/nextjs';

/**
 * Next.js instrumentation hook — runs once per server runtime, including under
 * the custom `server.js` entry point Hostinger uses (`next({dev:false}).prepare()`
 * still invokes it). This is where Sentry's server/edge SDKs get initialised.
 *
 * Server/edge only, no browser SDK — see README → Monitoring for why.
 * `onRequestError` still reports React Server Component rendering errors from
 * the server side, without needing the client bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
