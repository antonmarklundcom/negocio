import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getListings,
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

export async function generateStaticParams() {
  const combos = await getCategoryCityZonaCombosWithListings();
  return combos.map((c) => ({ categoria: c.categoria, ciudad: c.ciudad, barrio: slugify(c.zona) }));
}

function validRoute(categoria: string, ciudad: string): boolean {
  return !RESERVED_SLUGS.has(categoria) && isKnownCategory(categoria) && isKnownCity(ciudad);
}

export async function generateMetadata(
  props: { params: Promise<{ categoria: string; ciudad: string; barrio: string }> },
): Promise<Metadata> {
  const params = await props.params;
  if (!validRoute(params.categoria, params.ciudad)) return { title: 'Página no encontrada' };
  const combo = await findCombo(params.categoria, params.ciudad, params.barrio);
  if (!combo) return { title: 'Página no encontrada' };

  const plural = categoryLabelPlural(params.categoria);
  const city = cityLabel(params.ciudad);
  return {
    title: `${plural} en ${combo.zona}, ${city}`,
    description: `Los mejores ${plural.toLowerCase()} en ${combo.zona}, ${city}. Fotos, horarios, ubicación y contacto directo.`,
    alternates: { canonical: `${SITE_URL}/${params.categoria}/${params.ciudad}/${params.barrio}` },
  };
}

export default async function CategoryCityBarrioPage(
  props: {
    params: Promise<{ categoria: string; ciudad: string; barrio: string }>;
    searchParams: Promise<RawParams>;
  },
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
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

  const plural = categoryLabelPlural(params.categoria);
  const city = cityLabel(params.ciudad);
  const cat = getCategory(params.categoria)!;
  const crumbs = [
    { label: 'Inicio', href: '/' },
    { label: plural, href: `/${params.categoria}` },
    { label: city, href: `/${params.categoria}/${params.ciudad}` },
    { label: combo.zona },
  ];

  const baseParams: Record<string, string> = {};
  for (const k of ['q', 'abierto', 'sort']) {
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
          {plural} en {combo.zona}, {city}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink2">
          {cat.labelPlural} en {combo.zona}, {city}: {total} {total === 1 ? 'negocio' : 'negocios'} con fotos,
          horarios y contacto directo. Elegí, comparás y escribís en segundos.
        </p>
      </header>

      <ResultsSection
        query={query}
        basePath={`/${params.categoria}/${params.ciudad}/${params.barrio}`}
        baseParams={baseParams}
        showRubro={false}
        showZona={false}
      />
    </div>
  );
}
