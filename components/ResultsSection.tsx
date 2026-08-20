import { getTranslations } from 'next-intl/server';
import type { ListingQuery } from '@/lib/types';
import type { Locale } from '@/lib/i18n/routing';
import { getListings, getCategories, getCities } from '@/lib/listings-repo';
import { FilterBar } from './FilterBar';
import { SearchView } from './SearchView';
import { Pagination } from './Pagination';
import { JsonLd, itemListJsonLd } from '@/lib/jsonld';

/**
 * Shared results section used by /buscar and the category/landing pages.
 * Fetches everything on the server (SSR) and composes the filter row, the
 * list/map view and pagination. `showRubro`/`showZona` hide a filter that is
 * already fixed by the route (e.g. rubro on /[categoria]).
 */
export async function ResultsSection({
  query,
  basePath,
  baseParams,
  locale,
  showRubro = true,
  showZona = true,
}: {
  query: ListingQuery;
  basePath: string;
  baseParams: Record<string, string>;
  locale: Locale;
  showRubro?: boolean;
  showZona?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: 'search' });
  const [{ items, total }, categories, cities] = await Promise.all([
    getListings(query),
    getCategories(),
    getCities(),
  ]);

  // Zona options scoped to the active rubro/ciudad (ignore the zona filter itself).
  const { items: zonaSource } = await getListings({
    ...query,
    zona: undefined,
    page: 1,
    pageSize: 500,
  });
  const zonas = [...new Set(zonaSource.map((l) => l.zona).filter((z): z is string => !!z))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );

  const pageSize = query.pageSize ?? 12;
  const totalPages = Math.ceil(total / pageSize);
  const page = query.page ?? 1;

  return (
    <div>
      <div className="mb-5">
        <FilterBar
          categories={categories}
          cities={cities}
          zonas={zonas}
          showRubro={showRubro}
          showZona={showZona}
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-card border border-line bg-paper p-10 text-center">
          <p className="font-serif text-xl font-semibold">{t('noResults')}</p>
          <p className="mt-2 text-sm text-ink2">{t('noResultsHint')}</p>
        </div>
      ) : (
        <>
          <SearchView listings={items} />
          <Pagination basePath={basePath} baseParams={baseParams} page={page} totalPages={totalPages} />
          <JsonLd data={itemListJsonLd(items, locale, basePath)} />
        </>
      )}
    </div>
  );
}
