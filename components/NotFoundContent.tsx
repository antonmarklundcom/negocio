import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { NotFoundBody } from '@/components/NotFoundBody';
import type { Locale } from '@/lib/i18n/routing';

/**
 * A 404 that brings its own chrome.
 *
 * Used by the two `not-found.tsx` files that sit OUTSIDE the public layout —
 * `(site)/not-found.tsx` (a URL that never reached the locale segment) and
 * `(panel)/not-found.tsx` (what an unauthorised visitor to `/admin` is served).
 * Those two must render **identical** output: the decision that "`/admin` 404s
 * for the unauthorised, not 403" is worth nothing if the panel's 404 looks
 * different from a genuinely missing page, and two hand-maintained copies would
 * have drifted the first time either was touched.
 *
 * Inside the public layout the chrome is already there, so
 * `(public)/not-found.tsx` renders `NotFoundBody` on its own.
 */
export function NotFoundContent({ locale }: { locale: Locale }) {
  return (
    <>
      <Header locale={locale} />
      <NotFoundBody />
      <Footer locale={locale} />
    </>
  );
}
