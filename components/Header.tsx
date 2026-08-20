import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/link';
import { getPathname } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { LanguageSwitcherSlot } from './LanguageSwitcher';
import { Search } from './icons';

/**
 * Site header: wordmark, nav, desktop search box, primary CTA (§6.8).
 *
 * Still a server component. `getTranslations` reads the request locale set by
 * the layout, so translating the chrome did not turn the header into client
 * JavaScript (ROADMAP W3-3).
 */
export async function Header({ locale }: { locale: Locale }) {
  // Explicit locale — see the note in (site)/[locale]/layout.tsx.
  const t = await getTranslations({ locale, namespace: 'nav' });
  // A browser GET submit does not go through the router, so this needs the
  // real prefixed path: on /en it must post to /en/buscar, not /buscar.
  // `locale` is a prop rather than a `getLocale()` call — see (public)/layout.tsx.
  const searchAction = getPathname({ href: '/buscar', locale });

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="shrink-0 font-serif text-[22px] font-semibold tracking-tight md:text-[24px]">
          negocio<span className="text-terra">.com.py</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-5 text-sm font-semibold text-ink2 md:flex">
          {/* /rubros is the crawlable category hub (W1-1); this link was still
              pointing at /buscar, the same stale target the mobile tab had. */}
          <Link href="/rubros" className="transition-colors hover:text-ink">
            {t('categories')}
          </Link>
          <Link href="/buscar" className="transition-colors hover:text-ink">
            {t('search')}
          </Link>
          <Link href="/favoritos" className="transition-colors hover:text-ink">
            {t('favorites')}
          </Link>
        </nav>

        <form action={searchAction} className="ml-auto hidden items-center md:flex">
          <label className="flex w-[280px] items-center gap-2 rounded-card border border-line bg-paper px-3 py-2">
            <Search size={16} className="text-ink3" />
            <input
              name="q"
              placeholder={t('searchPlaceholder')}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink3"
              aria-label={t('searchLabel')}
            />
          </label>
        </form>

        <LanguageSwitcherSlot className="ml-auto md:ml-3" />

        <Link
          href="/sumar-negocio"
          className="rounded-card bg-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blued md:ml-1"
        >
          {t('addBusiness')}
        </Link>
      </div>
    </header>
  );
}
