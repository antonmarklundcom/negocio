import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import { NotFoundContent } from '@/components/NotFoundContent';

/**
 * 404 for the staff-panel tree — the page an unauthorised visitor to /admin
 * is served.
 *
 * Rendered in the default locale, not the requested one: Next resolves
 * `not-found` above the `[locale]` segment, so there is no locale param to read
 * here. Spanish is the honest answer for an unknown URL on a Paraguayan
 * directory, and it keeps this file identical to the panel's copy — see
 * `components/NotFoundContent.tsx` for why that matters.
 */
export default function NotFound() {
  setRequestLocale(routing.defaultLocale);
  return (
    <NextIntlClientProvider locale={routing.defaultLocale}>
      <NotFoundContent locale={routing.defaultLocale} />
    </NextIntlClientProvider>
  );
}
