import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/BottomNav';
import { PromoBanner } from '@/components/PromoBanner';

/**
 * The consumer chrome. Everything a visitor sees lives under this group; the
 * admin and the login page deliberately do not, so they never render the site
 * header, the mobile bottom bar or the promo banner.
 *
 * `(public)` is a route group — it does not appear in any URL.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PromoBanner />
      <Header />
      <main className="pb-20 md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}
