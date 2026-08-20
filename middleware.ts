import createMiddleware from 'next-intl/middleware';
import { routing } from '@/lib/i18n/routing';

/**
 * Locale routing for the **public site only** (ROADMAP W3-3).
 *
 * The matcher is a deny-list rather than an allow-list, because the public site
 * owns the top-level namespace: `/restaurantes` and `/lugar/x` are real routes,
 * so anything not explicitly excluded has to reach the locale middleware.
 *
 * Excluded, deliberately:
 *
 * - `/admin`, `/ingresar`, `/cambiar-contrasena` — staff tooling, Spanish only.
 *   Localising them would multiply every admin URL, break the e2e suite's
 *   paths, and translate a panel nobody outside the office ever opens.
 * - `/api` — a JSON contract (§7). A locale segment on an API route is a
 *   breaking change to every consumer for no benefit.
 * - `/sitemap.xml`, `/robots.txt` and the image routes — single files that
 *   handle both locales themselves; `sitemap.ts` emits the pair with
 *   `alternates`, which a rewritten-per-locale sitemap could not do.
 * - `/_next`, and anything with a file extension.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    // Each exclusion is anchored to a whole first segment — `admin(?:/|$)`, not
    // bare `admin`. A prefix match would also exclude `/administracion`, a
    // perfectly good future rubro slug, from locale routing.
    '/((?!(?:api|admin|ingresar|cambiar-contrasena|_next|seed)(?:/|$)|sitemap\\.xml$|robots\\.txt$|opengraph-image$|icon\\.svg$|favicon\\.ico$|.*\\..*$).*)',
  ],
};
