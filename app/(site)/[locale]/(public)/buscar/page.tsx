import type { Metadata } from 'next';
import { carriedParams, toListingQuery, type RawParams } from '@/lib/search-params';
import { getListings } from '@/lib/listings-repo';
import { categoryLabelPluralFor } from '@/lib/categories';
import { cityLabel } from '@/lib/cities';
import { ResultsSection } from '@/components/ResultsSection';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  const t = await getTranslations({ locale, namespace: 'search' });
  return {
    title: t('searchTitle'),
    description: t('searchDescription'),
    alternates: alternatesFor('/buscar', locale),
  };
}

export default async function BuscarPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { locale: rawLocale } = await props.params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'search' });
  const tl = await getTranslations({ locale, namespace: 'landing' });

  const searchParams = await props.searchParams;
  const query = toListingQuery(searchParams);
  const { total } = await getListings(query);

  // Build a human title from whatever filters are active. Assembled from
  // translated fragments rather than one message, because which fragments are
  // present depends on the filters — "en Villa Morra" only exists when a zona
  // is set — and an ICU message with five optional slots is unreadable to
  // whoever has to translate it next.
  const parts: string[] = [];
  if (query.q) parts.push(`“${query.q}”`);
  if (query.categoria) parts.push(categoryLabelPluralFor(query.categoria, locale));
  if (query.zona) parts.push(tl('inPlace', { place: query.zona }));
  else if (query.ciudad) parts.push(tl('inPlace', { place: cityLabel(query.ciudad) }));
  const title = parts.length ? parts.join(' ') : t('allBusinesses');

  return (
    <div className="mx-auto max-w-content px-4 py-6 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="font-serif text-[28px] font-semibold leading-tight md:text-[32px]">{title}</h1>
        <p className="mt-1 text-sm font-semibold text-ink2">
          {t('resultCount', { count: total })}
        </p>
      </header>

      <ResultsSection
        locale={locale}
        query={query}
        basePath="/buscar"
        baseParams={carriedParams(searchParams)}
      />
    </div>
  );
}
