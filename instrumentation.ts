/**
 * Next.js instrumentation hook — runs once per server runtime, including under
 * the custom `server.js` entry point Hostinger uses (`next({dev:false}).prepare()`
 * still invokes it). This is where Sentry's server/edge SDKs get initialised;
 * `sentry.client.config.ts` covers the browser separately.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
