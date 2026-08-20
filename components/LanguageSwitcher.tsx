'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_LABEL, routing, type Locale } from '@/lib/i18n/routing';
import { Link, usePathname } from '@/lib/i18n/link';

/**
 * Language switcher (ROADMAP D1 / W3-3).
 *
 * **Real `<a>` elements, not a `<select>` with an onChange.** Each locale of a
 * page is its own URL with its own hreflang annotation; rendering them as links
 * is what lets a crawler follow them, a visitor middle-click them, and the whole
 * thing work with JavaScript off. A router.push from a select would be a
 * language switcher that only exists for people who already have the page.
 *
 * It keeps the current path **and its query string**, so switching language on
 * a filtered search result does not throw the filters away.
 *
 * **It must be rendered inside a `<Suspense>`** — `LanguageSwitcherSlot` below
 * does that. `useSearchParams` is a dynamic API, and this component sits in the
 * header, i.e. inside the layout of every public page: unguarded, it opts the
 * entire public site out of static rendering, which silently undoes W1-3's ISR
 * and turns every listing view back into a MySQL round-trip. The boundary keeps
 * the cost where it belongs — the query string is filled in on the client, and
 * the only page where one exists is `/buscar`, which is dynamic regardless.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const t = useTranslations('language');
  const active = useLocale() as Locale;
  const pathname = usePathname();
  const params = useSearchParams();

  /**
   * `usePathname` here is locale-free — on `/en/buscar` it returns `/buscar` —
   * so the same href describes the same page in every locale, and the `locale`
   * prop on each link does the prefixing. Nothing string-swaps `/en` in or out,
   * which is what would go wrong the first time a listing slug contained "en".
   */
  const qs = params.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;

  return (
    <div className={`flex items-center gap-1 ${className}`} role="group" aria-label={t('label')}>
      {routing.locales.map((locale) => {
        const current = locale === active;
        return (
          <Link
            key={locale}
            href={href}
            locale={locale}
            hrefLang={locale}
            aria-current={current ? 'true' : undefined}
            // Tell the crawler this is the same content in another language
            // rather than a related page worth its own ranking signal.
            rel="alternate"
            title={t('switchTo', { language: LOCALE_LABEL[locale] })}
            className={`rounded-[8px] px-2 py-1 text-[12px] font-bold uppercase tracking-wide transition-colors ${
              current ? 'bg-ink text-white' : 'text-ink3 hover:text-ink'
            }`}
          >
            {locale}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * The switcher with its Suspense boundary and a same-size placeholder, so the
 * header does not reflow when it resolves. This is what layouts should render.
 */
export function LanguageSwitcherSlot({ className = '' }: { className?: string }) {
  return (
    <Suspense fallback={<div aria-hidden className={`h-[26px] w-[68px] ${className}`} />}>
      <LanguageSwitcher className={className} />
    </Suspense>
  );
}
