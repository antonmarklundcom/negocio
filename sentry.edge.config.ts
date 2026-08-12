import * as Sentry from '@sentry/nextjs';

/**
 * Edge runtime error monitoring. This app has no middleware or edge routes
 * today, so this branch of `instrumentation.ts` never actually runs — the
 * file exists so a future edge route is covered without anyone remembering
 * to add it. Same env-gating as `sentry.server.config.ts`.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
