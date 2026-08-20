import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '../config';
import { OG_LOCALE, routing, type Locale } from './routing';
import { alternatesFor } from './alternates';

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
    openGraph: {
      type: 'website',
      locale: OG_LOCALE[locale],
      siteName: SITE_NAME,
      url: SITE_URL,
    },
    robots: { index: true, follow: true },
  };
}
