import type { Metadata } from 'next';
import type { RawParams } from '@/lib/search-params';
import { getListings } from '@/lib/listings-repo';
import { decodeFavorites, FAVORITES_LIMIT } from '@/lib/favorites';
import { ListingCard } from '@/components/ListingCard';
import { FavoritesSync } from '@/components/FavoritesSync';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';

/**
 * Saved businesses (ROADMAP W3-2 / D9).
 *
 * The list lives in `localStorage`; `FavoritesSync` copies it into `?ids=` so
 * this server component can do the reading. Listing data is never fetched from
 * the client (README → Rendering), so a saved card shows today's phone number
 * and today's premium state rather than a snapshot taken when it was saved.
 */
export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const t = await getTranslations({ locale: toLocale(raw), namespace: 'favorites' });
  return {
    title: t('title'),
    description: t('description'),
    // A personal URL, and one that carries a list of slugs. Nothing here belongs
    // in an index, and it must never end up in the sitemap.
    robots: { index: false, follow: false },
    // Still annotated, even though it is noindex: the hreflang pair costs
    // nothing and keeps every public route answering the same shape.
    alternates: alternatesFor('/favoritos', toLocale(raw)),
  };
}

export default async function FavoritosPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { locale: rawLocale } = await props.params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'favorites' });
  const searchParams = await props.searchParams;
  const ids = searchParams.ids;
  const slugs = decodeFavorites(Array.isArray(ids) ? ids[0] : ids);

  // `slugs: []` is "match nothing" in both providers, so an empty list is one
  // cheap query rather than a special case — but there is no reason to make it.
  const { items } = slugs.length
    ? await getListings({ slugs, pageSize: FAVORITES_LIMIT, page: 1 })
    : { items: [] };

  // Restore the saved order (most recent first). The providers order by
  // relevancia, which is the right default everywhere else and wrong here:
  // this is the visitor's list, not ours to rank.
  const bySlug = new Map(items.map((l) => [l.slug, l]));
  const listings = slugs.map((s) => bySlug.get(s)).filter((l) => l != null);

  // A slug in the URL with no listing behind it is normal, not an error: the
  // business may have been archived or renamed since it was saved.
  const missing = slugs.length - listings.length;

  return (
    <div className="mx-auto max-w-content px-4 py-6 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="font-serif text-[28px] font-semibold leading-tight md:text-[32px]">{t('title')}</h1>
        <p className="mt-1 text-sm font-semibold text-ink2">
          {listings.length === 0
            ? t('onlyThisDevice')
            : t('savedCount', { count: listings.length })}
        </p>
      </header>

      <FavoritesSync shown={listings.map((l) => l.slug)} />

      {listings.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

      {missing > 0 && (
        <p className="mt-6 text-sm text-ink2">
          {t('missing', { count: missing })}
        </p>
      )}
    </div>
  );
}
