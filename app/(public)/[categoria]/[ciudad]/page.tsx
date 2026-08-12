import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getListings,
  getCategoryCityCombosWithListings,
  getCategoryCityZonaCombosWithListings,
} from '@/lib/listings-repo';
import { isKnownCategory, getCategory, categoryLabelPlural } from '@/lib/categories';
import { isKnownCity, cityLabel } from '@/lib/cities';
import { RESERVED_SLUGS, SITE_URL } from '@/lib/config';
import { toListingQuery, type RawParams } from '@/lib/search-params';
import { slugify } from '@/lib/format';
import { ResultsSection } from '@/components/ResultsSection';
import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd, breadcrumbJsonLd } from '@/lib/jsonld';

/** Pre-build only category×city combos that actually have listings (§6.3). */
export async function generateStaticParams() {
  const combos = await getCategoryCityCombosWithListings();
  return combos.map((c) => ({ categoria: c.categoria, ciudad: c.ciudad }));
}

function valid(categoria: string, ciudad: string): boolean {
  return !RESERVED_SLUGS.has(categoria) && isKnownCategory(categoria) && isKnownCity(ciudad);
}

export async function generateMetadata(
  props: {
    params: Promise<{ categoria: string; ciudad: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  if (!valid(params.categoria, params.ciudad)) return { title: 'Página no encontrada' };
  const plural = categoryLabelPlural(params.categoria);
  const city = cityLabel(params.ciudad);
  return {
    title: `${plural} en ${city}`,
    description: `Los mejores ${plural.toLowerCase()} en ${city}. Fotos, horarios, ubicación y contacto directo.`,
    alternates: { canonical: `${SITE_URL}/${params.categoria}/${params.ciudad}` },
  };
}

export default async function CategoryCityPage(
  props: {
    params: Promise<{ categoria: string; ciudad: string }>;
    searchParams: Promise<RawParams>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
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

  const plural = categoryLabelPlural(params.categoria);
  const city = cityLabel(params.ciudad);
  const cat = getCategory(params.categoria)!;
  const crumbs = [
    { label: 'Inicio', href: '/' },
    { label: plural, href: `/${params.categoria}` },
    { label: city },
  ];

  const baseParams: Record<string, string> = {};
  for (const k of ['zona', 'q', 'abierto', 'sort']) {
    const v = searchParams[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (s) baseParams[k] = s;
  }

  return (
    <div className="mx-auto max-w-content px-4 py-6 md:px-8 md:py-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumb items={crumbs} />

      <header className="mb-5 mt-3">
        <h1 className="font-serif text-[28px] font-semibold leading-tight md:text-[34px]">
          {plural} en {city}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink2">
          {cat.labelPlural} en {city}: {total} {total === 1 ? 'negocio' : 'negocios'} con fotos, horarios y
          contacto directo. Elegí, comparás y escribís en segundos.
        </p>
        {barrios.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-ink2">
            <span className="font-semibold">Por barrio:</span>
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

      <ResultsSection
        query={query}
        basePath={`/${params.categoria}/${params.ciudad}`}
        baseParams={baseParams}
        showRubro={false}
        showZona={false}
      />
    </div>
  );
}
