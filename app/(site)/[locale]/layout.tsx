import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import '../../globals.css';
import { FONT_VARIABLES } from '@/lib/fonts';
import { HTML_LANG, routing, toLocale } from '@/lib/i18n/routing';
import { defaultMetadata } from '@/lib/i18n/metadata';
import { Analytics } from '@/components/Analytics';

/**
 * Root layout for the **public site** (ROADMAP W3-3).
 *
 * It is a root layout — it renders `<html>` — because that is what makes
 * `lang` locale-aware. The alternative, one shared root that calls
 * `getLocale()`, reads a dynamic request API and therefore opts every page
 * beneath it into dynamic rendering: `/lugar/[slug]` silently stops being ISR
 * and every visit becomes a MySQL round-trip against an 8-connection pool,
 * undoing W1-3. `params.locale` is a segment, not a request API, so this stays
 * statically renderable.
 *
 * The consumer chrome (header, footer, bottom nav, promo banner) still lives in
 * `(public)/layout.tsx`; this file owns only the document and the locale.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  // Shared with the panel's root layout — see lib/i18n/metadata.ts for why
  // that is a security requirement rather than deduplication.
  return defaultMetadata(toLocale(locale));
}

export const viewport: Viewport = {
  themeColor: '#F7F1E6',
  width: 'device-width',
  initialScale: 1,
};

export default async function SiteRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // `/xyz` is a real 404, not a request for a locale called "xyz". Without this
  // one unknown segment would shadow the entire public site.
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for static rendering: without it, the first translation read opts
  // the route into dynamic rendering. See the comment above.
  setRequestLocale(locale);

  /**
   * `locale` and `messages` are passed to the provider EXPLICITLY rather than
   * left to be inherited.
   *
   * Inheritance goes through next-intl's ambient request locale, which is
   * populated either from a middleware header (dynamic requests only) or from
   * `setRequestLocale`'s React `cache()` — and during static prerendering
   * neither reliably reaches this app's component tree. Measured, not assumed:
   * with inheritance, `/en` rendered `<html lang="en">` and English metadata
   * (both read from `params`) while the header, the footer and every
   * `next-intl` `Link` fell back to Spanish and to unprefixed `/buscar` hrefs.
   * An English page that links into the Spanish tree on the first click is
   * worse than no English page.
   *
   * The route segment IS the locale, so threading it explicitly is also the
   * simpler contract: there is exactly one source of truth and it is a URL.
   */
  const messages = await getMessages({ locale });

  return (
    <html lang={HTML_LANG[locale]} className={FONT_VARIABLES}>
      <body className="min-h-screen bg-cream text-ink antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
