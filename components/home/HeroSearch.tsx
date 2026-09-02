import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/link';
import { getPathname } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import type { City } from '@/lib/types';
import { ChevronDown } from '@/components/icons';

/**
 * Hero + search, centred (Home_A "Búsqueda al centro"). Server component: a
 * plain `<form method="get">` needs no client JS, and the locale is threaded
 * as a prop rather than read with `getLocale()` (see (public)/layout.tsx).
 */
export async function HeroSearch({
  locale,
  cities,
  popular,
}: {
  locale: Locale;
  cities: City[];
  popular: { slug: string; label: string }[];
}) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const searchAction = getPathname({ href: '/buscar', locale });

  return (
    <section className="mx-auto max-w-wide px-4 pb-10 pt-10 text-center md:px-10 md:pt-16">
      <div className="mx-auto max-w-[860px]">
        <div className="mb-[18px] text-[13px] font-semibold uppercase tracking-[0.08em] text-terra">
          {t('eyebrow')}
        </div>
        <h1 className="mb-[18px] font-serif text-[38px] font-medium leading-[1.05] tracking-[-0.02em] [text-wrap:pretty] md:text-[60px]">
          {t('heroTitle')}
        </h1>
        <p className="mx-auto mb-9 max-w-[560px] text-[17px] leading-[1.5] text-ink2 md:text-[19px]">
          {t('heroLead')}
        </p>

        <form
          action={searchAction}
          method="get"
          className="grid gap-2 rounded-[18px] border-[1.5px] border-line bg-paper p-2 text-left shadow-hero md:grid-cols-[1.4fr_1fr_auto]"
        >
          <label className="flex flex-col gap-[2px] px-[14px] py-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink2">
              {t('searchWhat')}
            </span>
            <input
              name="q"
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchLabel')}
              className="border-0 bg-transparent p-0 text-[16px] text-ink outline-none"
            />
          </label>
          <label className="relative flex flex-col gap-[2px] border-t-[1.5px] border-line px-[14px] py-2 md:border-l-[1.5px] md:border-t-0">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink2">
              {t('searchCity')}
            </span>
            <select
              name="ciudad"
              defaultValue=""
              className="appearance-none border-0 bg-transparent p-0 pr-6 text-[16px] text-ink outline-none"
            >
              <option value="">{t('allParaguay')}</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute bottom-[13px] right-[14px] text-ink3" />
          </label>
          <button
            type="submit"
            className="min-h-[56px] rounded-[12px] bg-blue px-[26px] text-[16px] font-semibold text-white transition-colors hover:bg-blued"
          >
            {t('searchSubmit')}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[14px] text-ink2">{t('popular')}</span>
          {popular.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className="rounded-full bg-cream2 px-[14px] py-[6px] text-[14px] font-medium text-ink no-underline hover:bg-line"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
