import { defineRouting } from 'next-intl/routing';

/**
 * i18n routing (ROADMAP D1 / W3-3).
 *
 * Four decisions, all from D1 and none of them re-litigated here:
 *
 * - **Spanish is the default and carries no prefix.** `/` stays `/`,
 *   `/restaurantes/asuncion` stays where it is. Every existing URL, every
 *   indexed page and every link anyone has shared keeps working unchanged;
 *   English is additive.
 * - **English is `/en`.** A URL prefix rather than a cookie, because a cookie
 *   is invisible to crawlers — there would be exactly one indexable version of
 *   the site and the English one would not exist as far as Google is concerned.
 * - **Slugs stay Spanish and canonical.** `/en/restaurantes/asuncion`, not
 *   `/en/restaurants/asuncion`. The slugs are the taxonomy's identity, they are
 *   already in the database and the sitemap, and translating them would double
 *   the URL space of a directory whose businesses are Paraguayan either way.
 * - **Guaraní is not here yet** (D1). Adding it is one entry in `locales` plus a
 *   messages file, which is the whole point of doing the scaffold first.
 */
export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  // `as-needed`: the default locale is never prefixed, every other one always is.
  localePrefix: 'as-needed',
  /**
   * No automatic redirect on `Accept-Language`.
   *
   * A Paraguayan visitor whose phone reports `en-US` — which is common, phones
   * are sold with English defaults — would otherwise be bounced to an English
   * translation of a Spanish directory. The language switcher is explicit and
   * the crawler-facing hreflang tags do the rest.
   */
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

/** `<html lang>` and `og:locale` values — the full tags, not the short codes. */
export const HTML_LANG: Record<Locale, string> = { es: 'es-PY', en: 'en' };
export const OG_LOCALE: Record<Locale, string> = { es: 'es_PY', en: 'en_US' };

/** The label a visitor sees in the switcher, in its own language. */
export const LOCALE_LABEL: Record<Locale, string> = { es: 'Español', en: 'English' };

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

/**
 * Narrow a `[locale]` segment to a `Locale`.
 *
 * Next generates its own `LayoutProps`/`PageProps` types with `params.locale`
 * as a plain `string`, so a page cannot simply declare the union and be done.
 * The unknown case is unreachable in practice — `(site)/[locale]/layout.tsx`
 * calls `notFound()` before any page renders — but it is answered with the
 * default rather than a cast, so a future route added outside that layout
 * degrades to Spanish instead of indexing `undefined` translations.
 */
export function toLocale(value: string): Locale {
  return isLocale(value) ? value : routing.defaultLocale;
}
