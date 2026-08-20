import type { Metadata } from 'next';
import { carriedParams, toListingQuery, type RawParams } from '@/lib/search-params';
import { getListings } from '@/lib/listings-repo';
import { categoryLabelPlural } from '@/lib/categories';
import { cityLabel } from '@/lib/cities';
import { ResultsSection } from '@/components/ResultsSection';

export const metadata: Metadata = {
  title: 'Buscar negocios',
  description: 'Buscá restaurantes, tiendas, servicios y profesionales en todo Paraguay.',
};

export default async function BuscarPage(props: { searchParams: Promise<RawParams> }) {
  const searchParams = await props.searchParams;
  const query = toListingQuery(searchParams);
  const { total } = await getListings(query);

  // Build a human title from whatever filters are active.
  const parts: string[] = [];
  if (query.q) parts.push(`“${query.q}”`);
  if (query.categoria) parts.push(categoryLabelPlural(query.categoria));
  if (query.zona) parts.push(`en ${query.zona}`);
  else if (query.ciudad) parts.push(`en ${cityLabel(query.ciudad)}`);
  const title = parts.length ? parts.join(' ') : 'Todos los negocios';

  return (
    <div className="mx-auto max-w-content px-4 py-6 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="font-serif text-[28px] font-semibold leading-tight md:text-[32px]">{title}</h1>
        <p className="mt-1 text-sm font-semibold text-ink2">
          {total} {total === 1 ? 'negocio' : 'negocios'}
        </p>
      </header>

      <ResultsSection query={query} basePath="/buscar" baseParams={carriedParams(searchParams)} />
    </div>
  );
}
