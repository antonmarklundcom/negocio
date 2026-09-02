import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

// ROADMAP W3-3. Points next-intl at lib/i18n/request.ts and enables the
// `[locale]` segment's message loading. It wraps the config; Sentry wraps the
// result, so both plugins apply and neither has to know about the other.
const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

// This app deliberately ships no `sentry.client.config.ts` / global-error.js
// (README → Monitoring: the client SDK roughly doubled the shared JS bundle,
// a bad trade for a mostly server-rendered site). Sentry's build-time warning
// about that absence is expected, not a misconfiguration — suppress it.
process.env.SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING = '1';

// The R2/CDN host for uploaded listing photos (BUILD-SPEC-PR5 §2), derived
// from the same env var `lib/media/url.ts` reads at render time — next/image
// needs remote hosts allow-listed at BUILD time, so this has to be computed
// here rather than passed in some other way. Unset (R2 not configured yet) →
// no extra pattern; the app still boots and serves normally.
const mediaHost = (() => {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (!base) return undefined;
  try {
    return new URL(base).hostname;
  } catch {
    return undefined;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standard Hostinger Node.js Web App: `next build` / `next start`.
  // NEVER use output: 'export' — this site is server-rendered.
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Next defaults its build workers to os.cpus().length - 1, which on
    // Hostinger's shared box is the physical core count of the host, not
    // this account's share. Each worker is a Node process, counted against
    // the account-wide 200 "Max Processes" cap shared by 9 apps. One worker
    // keeps a deploy from tipping the account over the cap. Same fix as
    // vendercrm PR #84, propia.node PR #81, trabajo PR #82.
    cpus: 1,
  },
  // Next.js 16 decoupled ESLint from `next build` entirely (the `eslint`
  // config key here is no longer recognised) — there is nothing to disable.
  images: {
    // Seed assets are first-party local SVGs; allow next/image to serve them.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: mediaHost ? [{ protocol: 'https', hostname: mediaHost }] : [],
  },
};

// `withSentryConfig` adds request-tracing instrumentation and, when
// `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` are set, uploads source
// maps for readable stack traces. Unset — the default until someone creates a
// Sentry project — the plugin logs one line and skips the upload; it does not
// fail the build. `silent: true` keeps that line out of normal CI output.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // No client-side source maps without a token: nothing to upload, and this
  // avoids widening the `next build` output for a feature that isn't active.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  webpack: { treeshake: { removeDebugLogging: true } },
});
