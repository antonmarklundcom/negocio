import type { Metadata } from 'next';
import { Link } from '@/lib/i18n/link';
import { getPathname } from '@/lib/i18n/navigation';
import { getListings, getCategories } from '@/lib/listings-repo';
import { categoryLabelPluralFor } from '@/lib/categories';
import { CategoryIcon, Search } from '@/components/icons';
import { ListingCard } from '@/components/ListingCard';
import { JsonLd, siteJsonLd } from '@/lib/jsonld';
import { MAX_FEATURED_SLOTS } from '@/lib/config';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export const revalidate = 3600;

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description come from the locale layout's defaults; only the
  // hreflang set is per-page, and the home page's is the root one.
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  return { alternates: alternatesFor('/', locale) };
}

export default async function HomePage(props: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  // ROADMAP W3-3: opts this route back into static rendering. Reading a
  // translation without it makes the route dynamic, which would quietly undo
  // W1-3's caching — the page would still be correct, just uncached.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'home' });

  const [categories, featured, destacadoPortada] = await Promise.all([
    getCategories(),
    getListings({ sort: 'destacados', premiumFirst: true, pageSize: 6, page: 1 }),
    // "Destacado en portada" (ROADMAP Phase D item 3) — a limited, separately
    // sold home-page slot, distinct from the general Premium pool above.
    getListings({ destacado: true, sort: 'nombre', pageSize: MAX_FEATURED_SLOTS, page: 1 }),
  ]);

  return (
    <div>
      <JsonLd data={siteJsonLd(locale)} />

      {/* Hero */}
      <section className="border-b border-line bg-[linear-gradient(160deg,#FBF6EC,#F2E7D6)]">
        <div className="mx-auto max-w-content px-4 py-12 md:px-8 md:py-20">
          <h1 className="max-w-2xl font-serif text-[34px] font-semibold leading-[1.05] md:text-[52px]">
            {t('heroTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink2 md:text-[18px]">
            {t('heroLead')}
          </p>

          <form action={getPathname({ href: '/buscar', locale })} className="mt-7 flex max-w-xl items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-card border border-line bg-paper px-4 py-3 shadow-card">
              <Search size={18} className="text-ink3" />
              <input
                name="q"
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchLabel')}
                className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink3"
              />
            </label>
            <button
              type="submit"
              className="rounded-card bg-blue px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-blued"
            >
              {t('searchSubmit')}
            </button>
          </form>
        </div>
      </section>

      {/* Destacado en portada — a separately sold, limited slot (ROADMAP
          Phase D item 3), so it renders above the general Premium pool. */}
      {destacadoPortada.items.length > 0 && (
        <section className="mx-auto max-w-content px-4 pt-12 md:px-8">
          <h2 className="mb-6 font-serif text-[24px] font-semibold md:text-[28px]">{t('featuredOnHome')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destacadoPortada.items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="mx-auto max-w-content px-4 py-12 md:px-8">
        <h2 className="mb-6 font-serif text-[24px] font-semibold md:text-[28px]">{t('browseByCategory')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="group flex flex-col items-start gap-3 rounded-card border border-line bg-paper p-4 shadow-card transition-shadow hover:shadow-cardhover"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-terra2 text-terra">
                <CategoryIcon name={c.icon} size={22} />
              </span>
              <span className="text-[14px] font-semibold leading-snug text-ink group-hover:text-blued">
                {categoryLabelPluralFor(c.slug, locale)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.items.length > 0 && (
        <section className="mx-auto max-w-content px-4 pb-12 md:px-8">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-[24px] font-semibold md:text-[28px]">{t('featured')}</h2>
            <Link href="/buscar" className="text-sm font-semibold text-blue hover:text-blued">
              {t('seeAll')}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* CTA band */}
      <section className="mx-auto max-w-content px-4 pb-16 md:px-8">
        <div className="rounded-card bg-ink p-8 md:flex md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="font-serif text-[26px] font-semibold text-white md:text-[32px]">
              {t('ctaTitle')}
            </h2>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/70">
              {t('ctaBody')}
            </p>
          </div>
          <Link
            href="/sumar-negocio"
            className="mt-5 inline-block rounded-card bg-white px-6 py-3.5 text-sm font-bold text-ink md:mt-0"
          >
            {t('ctaButton')}
          </Link>
        </div>
      </section>
    </div>
  );
}
