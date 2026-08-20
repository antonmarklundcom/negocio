import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getListings,
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

/**
 * SEO barrio pages (ROADMAP Phase D item 6): "Los mejores [rubro] en
 * [barrio], [ciudad]". `zona` is free text an editor typed (no controlled
 * vocabulary — BUILD-SPEC-PR4 §1), so the URL segment is a slug of it and the
 * page resolves back to the real string via the same combo list
 * `generateStaticParams` uses. Never render an empty shell (§6.3): a combo
 * with no listings 404s, exactly like the rubro and rubro×ciudad pages.
 */

async function findCombo(categoria: string, ciudad: string, barrioSlug: string) {
  const combos = await getCategoryCityZonaCombosWithListings();
  return combos.find(
    (c) => c.categoria === categoria && c.ciudad === ciudad && slugify(c.zona) === barrioSlug,
  );
}

/**
 * ROADMAP W1-3 asked for an explicit `revalidate` here. Be clear about what it
 * does: this route reads `searchParams` (filters, sort, page), so the page
 * shell stays dynamic and this value governs the cached data reads underneath
 * it — the catalogue cache in `lib/listings-repo.ts`. It does not turn the
 * route into ISR, and pretending otherwise would be the misleading part.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const combos = await getCategoryCityZonaCombosWithListings();
  return combos.map((c) => ({ categoria: c.categoria, ciudad: c.ciudad, barrio: slugify(c.zona) }));
}

function validRoute(categoria: string, ciudad: string): boolean {
  return !RESERVED_SLUGS.has(categoria) && isKnownCategory(categoria) && isKnownCity(ciudad);
}

export async function generateMetadata(
  props: { params: Promise<{ locale: string; categoria: string; ciudad: string; barrio: string }> },
): Promise<Metadata> {
  const params = await props.params;
  const locale = toLocale(params.locale);
  const t = await getTranslations({ locale, namespace: 'landing' });
  if (!validRoute(params.categoria, params.ciudad)) return { title: t('notFoundTitle') };
  const combo = await findCombo(params.categoria, params.ciudad, params.barrio);
  if (!combo) return { title: t('notFoundTitle') };

  const plural = categoryLabelPluralFor(params.categoria, locale);
  const city = cityLabel(params.ciudad);
  return {
    title: t('barrioTitle', { category: plural, barrio: combo.zona, city }),
    description: t('barrioDescription', { category: plural.toLowerCase(), barrio: combo.zona, city }),
    alternates: alternatesFor(`/${params.categoria}/${params.ciudad}/${params.barrio}`, toLocale(params.locale)),
  };
}

export default async function CategoryCityBarrioPage(
  props: {
    params: Promise<{ locale: string; categoria: string; ciudad: string; barrio: string }>;
    searchParams: Promise<RawParams>;
  },
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const locale = toLocale(params.locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'landing' });
  const tb = await getTranslations({ locale, namespace: 'breadcrumb' });
  if (!validRoute(params.categoria, params.ciudad)) notFound();

  const combo = await findCombo(params.categoria, params.ciudad, params.barrio);
  if (!combo) notFound(); // no listings for this rubro×ciudad×barrio — never an empty shell (§6.3)

  const query = toListingQuery(searchParams, {
    categoria: params.categoria,
    ciudad: params.ciudad,
    zona: combo.zona,
  });
  const { total } = await getListings(query);
  if (total === 0) notFound();

  const plural = categoryLabelPluralFor(params.categoria, locale);
  const city = cityLabel(params.ciudad);
  const crumbs = [
    { label: tb('home'), href: '/' },
    { label: plural, href: `/${params.categoria}` },
    { label: city, href: `/${params.categoria}/${params.ciudad}` },
    { label: combo.zona },
  ];

  const baseParams = carriedParams(searchParams);

  return (
    <div className="mx-auto max-w-content px-4 py-6 md:px-8 md:py-8">
      <JsonLd data={breadcrumbJsonLd(crumbs, locale)} />
      <Breadcrumb items={crumbs} />

      <header className="mb-5 mt-3">
        <h1 className="font-serif text-[28px] font-semibold leading-tight md:text-[34px]">
          {t('barrioTitle', { category: plural, barrio: combo.zona, city })}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink2">
          {t('barrioLead', { category: plural, barrio: combo.zona, city, count: total })}
        </p>
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
          basePath={`/${params.categoria}/${params.ciudad}/${params.barrio}`}
          baseParams={baseParams}
          showRubro={false}
          showZona={false}
        />
      </Suspense>
    </div>
  );
}
