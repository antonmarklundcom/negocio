import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '../config';
import { OG_LOCALE, routing, type Locale } from './routing';
import { alternatesFor, localeUrl } from './alternates';

/**
 * The site-wide default metadata, in one place.
 *
 * It is shared by BOTH root layouts (ROADMAP W3-3) — the public one under
 * `[locale]` and the staff panel's — and that is a security requirement, not
 * tidiness. `/admin` 404s for the unauthorised rather than 403-ing, and that
 * decision is worth nothing if the 404 it serves carries `<title>Panel</title>`
 * while every other missing page carries the site's: `curl /admin` would then
 * confirm the panel exists to anyone who asked.
 *
 * The panel's own layouts still set `robots: { index: false, follow: false }`
 * (`admin/layout.tsx`, `(auth)/layout.tsx`), so the pages a signed-in member of
 * staff actually reaches are still marked noindex. What is shared here is only
 * what an anonymous visitor can see — which is the 404 and nothing else.
 */
const TITLES: Record<Locale, string> = {
  es: `${SITE_NAME} — Encontrá negocios en Paraguay`,
  en: `${SITE_NAME} — Find businesses in Paraguay`,
};

const DESCRIPTIONS: Record<Locale, string> = {
  es: 'El directorio de negocios de Paraguay. Encontrá restaurantes, tiendas, servicios y profesionales cerca tuyo y contactalos al instante.',
  en: "Paraguay's business directory. Find restaurants, shops, services and professionals near you and contact them instantly.",
};

export function defaultMetadata(locale: Locale = routing.defaultLocale): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: TITLES[locale], template: `%s · ${SITE_NAME}` },
    description: DESCRIPTIONS[locale],
    alternates: alternatesFor('/', locale),
    openGraph: siteOpenGraph('/', locale),
    robots: { index: true, follow: true },
  };
}

/**
 * The site-wide Open Graph fields, for a given page.
 *
 * **Any page that sets `openGraph` at all must build it from here.** Next
 * merges metadata *shallowly*: a page's `openGraph` object replaces the
 * layout's outright rather than filling in around it, so the four fields above
 * — `type`, `locale`, `siteName`, `url` — vanish from every page that declared
 * an `openGraph` of its own. Measured on a production build before this helper
 * existed: `/lugar/<slug>` emitted `og:title`, `og:description` and nothing
 * else, on a site whose links are shared almost entirely on WhatsApp.
 *
 * `url` is per-page and locale-prefixed, so the shared card names the page it
 * came from rather than the home page.
 */
export function siteOpenGraph(path: string, locale: Locale): NonNullable<Metadata['openGraph']> {
  return {
    type: 'website',
    locale: OG_LOCALE[locale],
    siteName: SITE_NAME,
    url: localeUrl(path, locale),
  };
}
