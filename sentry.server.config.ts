import * as Sentry from '@sentry/nextjs';

/**
 * Server-side error monitoring (ROADMAP Phase C). Env-gated like every other
 * integration in this app: with `SENTRY_DSN` unset, `Sentry.init` runs with
 * `enabled: false` and every call becomes a no-op — no network calls, no
 * boot-time throw. Add the env var and redeploy to activate, same pattern as
 * the lead-routing webhooks.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Free-tier friendly: errors matter more than full trace volume here.
});
