import type { Metadata } from 'next';
import { Link } from '@/lib/i18n/link';
import { notFound } from 'next/navigation';
import {
  getListings,
  getCategoryCityCombosWithListings,
  getCategoryCityZonaCombosWithListings,
} from '@/lib/listings-repo';
import { categoryLabelPluralFor, isKnownCategory } from '@/lib/categories';
import { isKnownCity, cityLabel } from '@/lib/cities';
import { RESERVED_SLUGS } from '@/lib/config';
import { carriedParams, toListingQuery, type RawParams } from '@/lib/search-params';
import { slugify } from '@/lib/format';
import { Suspense } from 'react';
import { ResultsSection } from '@/components/ResultsSection';
import { ResultsSkeleton } from '@/components/Skeletons';
import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/** Pre-build only category×city combos that actually have listings (§6.3). */
/**
 * ROADMAP W1-3 asked for an explicit `revalidate` here. Be clear about what it
 * does: this route reads `searchParams` (filters, sort, page), so the page
 * shell stays dynamic and this value governs the cached data reads underneath
 * it — the catalogue cache in `lib/listings-repo.ts`. It does not turn the
 * route into ISR, and pretending otherwise would be the misleading part.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const combos = await getCategoryCityCombosWithListings();
  return combos.map((c) => ({ categoria: c.categoria, ciudad: c.ciudad }));
}

function valid(categoria: string, ciudad: string): boolean {
  return !RESERVED_SLUGS.has(categoria) && isKnownCategory(categoria) && isKnownCity(ciudad);
}

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string; categoria: string; ciudad: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const locale = toLocale(params.locale);
  const t = await getTranslations({ locale, namespace: 'landing' });
  if (!valid(params.categoria, params.ciudad)) return { title: t('notFoundTitle') };
  const plural = categoryLabelPluralFor(params.categoria, locale);
  const city = cityLabel(params.ciudad);
  return {
    title: t('categoryCityTitle', { category: plural, city }),
    description: t('categoryCityDescription', { category: plural.toLowerCase(), city }),
    alternates: alternatesFor(`/${params.categoria}/${params.ciudad}`, toLocale(params.locale)),
  };
}

export default async function CategoryCityPage(
  props: {
    params: Promise<{ locale: string; categoria: string; ciudad: string }>;
    searchParams: Promise<RawParams>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const locale = toLocale(params.locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'landing' });
  const tb = await getTranslations({ locale, namespace: 'breadcrumb' });
  if (!valid(params.categoria, params.ciudad)) notFound();

  const query = toListingQuery(searchParams, {
    categoria: params.categoria,
    ciudad: params.ciudad,
  });
  const [{ total }, zonaCombos] = await Promise.all([
    getListings(query),
    getCategoryCityZonaCombosWithListings(),
  ]);
  if (total === 0) notFound(); // empty combos 404, never an empty shell (§6.3)

  // Internal links into the barrio pages for this rubro×ciudad (ROADMAP Phase D item 6).
  const barrios = zonaCombos
    .filter((c) => c.categoria === params.categoria && c.ciudad === params.ciudad)
    .sort((a, b) => a.zona.localeCompare(b.zona, 'es'));

  const plural = categoryLabelPluralFor(params.categoria, locale);
  const city = cityLabel(params.ciudad);
  const crumbs = [
    { label: tb('home'), href: '/' },
    { label: plural, href: `/${params.categoria}` },
    { label: city },
  ];

  const baseParams = carriedParams(searchParams);

  return (
    <div className="mx-auto max-w-content px-4 py-6 md:px-8 md:py-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumb items={crumbs} />

      <header className="mb-5 mt-3">
        <h1 className="font-serif text-[28px] font-semibold leading-tight md:text-[34px]">
          {t('categoryCityTitle', { category: plural, city })}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink2">
          {t('cityLead', { category: plural, city, count: total })}
        </p>
        {barrios.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-ink2">
            <span className="font-semibold">{t('byBarrio')}</span>
            {barrios.map((b) => (
              <Link
                key={b.zona}
                href={`/${params.categoria}/${params.ciudad}/${slugify(b.zona)}`}
                className="text-blue hover:underline"
              >
                {b.zona}
              </Link>
            ))}
          </p>
        )}
      </header>

      {/* The heavy part of the page: four more listing queries, one of them a
          500-row scan for the zona options. Streaming it behind a skeleton lets
          the h1, the breadcrumb and the city links paint immediately.

          Deliberately an in-page <Suspense>, NOT a `loading.tsx`: a route-level
          loading boundary flushes the response before the page function runs, so
          the `notFound()` above would be served as HTTP 200 with the 404 swapped
          in client-side. Measured, not assumed — `loading.tsx` here turned every
          unknown rubro into a soft 404, which on a directory site is an SEO bug,
          not a cosmetic one. */}
      <Suspense fallback={<ResultsSkeleton />}>
        <ResultsSection
          locale={locale}
          query={query}
          basePath={`/${params.categoria}/${params.ciudad}`}
          baseParams={baseParams}
          showRubro={false}
          showZona={false}
        />
      </Suspense>
    </div>
  );
}
