import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/BottomNav';
import { PromoBanner } from '@/components/PromoBanner';
import { toLocale } from '@/lib/i18n/routing';

/**
 * The consumer chrome. Everything a visitor sees lives under this group; the
 * admin and the login page deliberately do not, so they never render the site
 * header, the mobile bottom bar or the promo banner.
 *
 * `(public)` is a route group — it does not appear in any URL.
 *
 * The locale is read from the segment and **passed down as a prop** rather than
 * looked up inside `Header`/`Footer` (ROADMAP W3-3). `getLocale()` is a dynamic
 * request API: called from a component in this layout it opts every public page
 * out of static rendering, which would silently undo W1-3's ISR — the pages
 * would still be correct, just uncached, and nothing would say so.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = toLocale(raw);
  setRequestLocale(locale);

  return (
    <>
      <PromoBanner />
      <Header locale={locale} />
      <main className="pb-20 md:pb-0">{children}</main>
      <Footer locale={locale} />
      <BottomNav />
    </>
  );
}
