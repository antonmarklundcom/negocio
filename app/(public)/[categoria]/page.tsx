import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getListings, getCategoryCityCombosWithListings } from '@/lib/listings-repo';
import { isKnownCategory, getCategory, categoryLabelPlural } from '@/lib/categories';
import { cityLabel } from '@/lib/cities';
import { RESERVED_SLUGS, SITE_URL } from '@/lib/config';
import { toListingQuery, type RawParams } from '@/lib/search-params';
import { ResultsSection } from '@/components/ResultsSection';
import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd, breadcrumbJsonLd } from '@/lib/jsonld';

/** Pre-build category landings that actually have listings. */
export async function generateStaticParams() {
  const combos = await getCategoryCityCombosWithListings();
  return [...new Set(combos.map((c) => c.categoria))].map((categoria) => ({ categoria }));
}

function valid(categoria: string): boolean {
  return !RESERVED_SLUGS.has(categoria) && isKnownCategory(categoria);
}

export async function generateMetadata({ params }: { params: { categoria: string } }): Promise<Metadata> {
  if (!valid(params.categoria)) return { title: 'Página no encontrada' };
  const plural = categoryLabelPlural(params.categoria);
  return {
    title: `${plural} en Paraguay`,
    description: `Encontrá ${plural.toLowerCase()} en todo Paraguay. Mirá fotos, horarios y contactá directo.`,
    alternates: { canonical: `${SITE_URL}/${params.categoria}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { categoria: string };
  searchParams: RawParams;
}) {
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

  const baseParams: Record<string, string> = {};
  for (const k of ['ciudad', 'zona', 'q', 'abierto', 'sort']) {
    const v = searchParams[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (s) baseParams[k] = s;
  }

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

      <ResultsSection
        query={query}
        basePath={`/${params.categoria}`}
        baseParams={baseParams}
        showRubro={false}
      />
    </div>
  );
}
