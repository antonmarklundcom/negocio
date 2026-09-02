import type { Metadata } from 'next';
import { Link } from '@/lib/i18n/link';
import { getListings, getCategories, getCities } from '@/lib/listings-repo';
import { categoryLabelPluralFor } from '@/lib/categories';
import { computeOpenState } from '@/lib/hours';
import { isPremium } from '@/lib/listing';
import { JsonLd, siteJsonLd } from '@/lib/jsonld';
import { MAX_FEATURED_SLOTS } from '@/lib/config';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HeroSearch } from '@/components/home/HeroSearch';
import { FeaturedCard } from '@/components/home/FeaturedCard';
import { CategoryTile } from '@/components/home/CategoryTile';
import { CityBlock } from '@/components/home/CityBlock';
import { PlanTable } from '@/components/home/PlanTable';

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

  const [categories, cities, destacadoPortada, premiumPool] = await Promise.all([
    getCategories(),
    getCities(),
    // "Destacado en portada" (ROADMAP Phase D item 3) — a limited, separately
    // sold home-page slot, distinct from the general Premium pool below.
    getListings({ destacado: true, sort: 'nombre', pageSize: MAX_FEATURED_SLOTS, page: 1 }),
    getListings({ sort: 'destacados', premiumFirst: true, pageSize: 8, page: 1 }),
  ]);

  // Paid slots first, then the premium pool filling any remaining spots
  // (deduped by id), capped at 8 — and only ever actually-premium listings,
  // since a "destacado en portada" slot alone does not entitle a card here.
  const seen = new Set<string>();
  const featured = [...destacadoPortada.items, ...premiumPool.items]
    .filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    })
    .filter(isPremium)
    .slice(0, 8);

  const popular = categories.slice(0, 5).map((c) => ({
    slug: c.slug,
    label: categoryLabelPluralFor(c.slug, locale),
  }));

  return (
    <div>
      <JsonLd data={siteJsonLd(locale)} />

      <HeroSearch locale={locale} cities={cities} popular={popular} />

      {featured.length > 0 && (
        <section className="mx-auto max-w-wide px-4 py-12 md:px-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="mb-[6px] font-serif text-[28px] font-medium tracking-[-0.015em] md:text-[34px]">
                {t('featured')}
              </h2>
              <p className="m-0 text-[15px] text-ink2">{t('featuredSub')}</p>
            </div>
            <Link href="/buscar?sort=destacados" className="whitespace-nowrap text-[15px] font-semibold text-blue hover:text-blued">
              {t('seeAll')}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((l) => (
              <FeaturedCard key={l.id} listing={l} open={computeOpenState(l.hours)} />
            ))}
          </div>
        </section>
      )}

      <section id="categorias" className="mx-auto max-w-wide px-4 py-10 md:px-10">
        <h2 className="mb-6 font-serif text-[28px] font-medium tracking-[-0.015em] md:text-[34px]">
          {t('browseByCategory')}
        </h2>
        <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <CategoryTile key={c.slug} category={c} locale={locale} />
          ))}
        </div>
      </section>

      <CityBlock locale={locale} cities={cities} />

      <section id="suma" className="mx-auto max-w-wide px-4 pb-20 pt-6 md:px-10">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <div className="mb-[14px] text-[13px] font-semibold uppercase tracking-[0.08em] text-terra">
              {t('forBusinesses')}
            </div>
            <h2 className="mb-4 font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.02em] [text-wrap:pretty] md:text-[44px]">
              {t('ctaTitle')}
            </h2>
            <p className="mb-7 max-w-[480px] text-[17px] leading-[1.55] text-ink2">{t('ctaBody')}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sumar-negocio"
                className="rounded-[12px] bg-blue px-6 py-[14px] text-[16px] font-semibold text-white transition-colors hover:bg-blued"
              >
                {t('ctaButton')}
              </Link>
              <Link
                href="/precios"
                className="rounded-[12px] border-[1.5px] border-line bg-paper px-6 py-[14px] text-[16px] font-semibold text-ink transition-colors hover:border-ink"
              >
                {t('ctaPremium')}
              </Link>
            </div>
          </div>
          <div>
            <PlanTable locale={locale} />
            <p className="mt-3 text-center text-[13px] text-ink3">
              {t('planAnnualNote')}{' '}
              <Link href="/precios" className="font-semibold text-blue">
                {t('planAnnualLink')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
