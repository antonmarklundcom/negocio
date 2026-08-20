import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getListings, getCategoryCityCombosWithListings } from '@/lib/listings-repo';
import { isKnownCategory, getCategory, categoryLabelPlural } from '@/lib/categories';
import { cityLabel } from '@/lib/cities';
import { RESERVED_SLUGS, SITE_URL } from '@/lib/config';
import { carriedParams, toListingQuery, type RawParams } from '@/lib/search-params';
import { Suspense } from 'react';
import { ResultsSection } from '@/components/ResultsSection';
import { ResultsSkeleton } from '@/components/Skeletons';
import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd, breadcrumbJsonLd } from '@/lib/jsonld';

/** Pre-build category landings that actually have listings. */
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
  return [...new Set(combos.map((c) => c.categoria))].map((categoria) => ({ categoria }));
}

function valid(categoria: string): boolean {
  return !RESERVED_SLUGS.has(categoria) && isKnownCategory(categoria);
}

export async function generateMetadata(props: { params: Promise<{ categoria: string }> }): Promise<Metadata> {
  const params = await props.params;
  if (!valid(params.categoria)) return { title: 'Página no encontrada' };
  const plural = categoryLabelPlural(params.categoria);
  return {
    title: `${plural} en Paraguay`,
    description: `Encontrá ${plural.toLowerCase()} en todo Paraguay. Mirá fotos, horarios y contactá directo.`,
    alternates: { canonical: `${SITE_URL}/${params.categoria}` },
  };
}

export default async function CategoryPage(
  props: {
    params: Promise<{ categoria: string }>;
    searchParams: Promise<RawParams>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  if (!valid(params.categoria)) notFound();

  const query = toListingQuery(searchParams, { categoria: params.categoria });
  const { total } = await getListings(query);
  if (total === 0) notFound(); // never render an empty shell (§6.3)

  const plural = categoryLabelPlural(params.categoria);
  const cat = getCategory(params.categoria)!;
  const crumbs = [
    { label: 'Inicio', href: '/' },
    { label: plural },
  ];

  const baseParams = carriedParams(searchParams);

  // Cities where this rubro exists, for internal links + SEO.
  const combos = await getCategoryCityCombosWithListings();
  const cities = combos.filter((c) => c.categoria === params.categoria);

  return (
    <div className="mx-auto max-w-content px-4 py-6 md:px-8 md:py-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumb items={crumbs} />

      <header className="mb-5 mt-3">
        <h1 className="font-serif text-[28px] font-semibold leading-tight md:text-[34px]">
          {plural} en Paraguay
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink2">
          {plural} en todo el país. Mirá fotos, horarios y ubicación, y contactá directo por WhatsApp o
          teléfono. {total} {total === 1 ? 'negocio' : 'negocios'} en {cat.labelPlural.toLowerCase()}.
        </p>
        {cities.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cities.map((c) => (
              <Link
                key={c.ciudad}
                href={`/${params.categoria}/${c.ciudad}`}
                className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink2 hover:text-ink"
              >
                {cityLabel(c.ciudad)} ({c.count})
              </Link>
            ))}
          </div>
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
          query={query}
          basePath={`/${params.categoria}`}
          baseParams={baseParams}
          showRubro={false}
        />
      </Suspense>
    </div>
  );
}
