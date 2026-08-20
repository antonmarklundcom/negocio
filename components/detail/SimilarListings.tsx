import { Link } from '@/lib/i18n/link';
import type { Listing } from '@/lib/types';
import { getListings } from '@/lib/listings-repo';
import { rankSimilar, similarQuery } from '@/lib/similar';
import { ListingCard } from '@/components/ListingCard';

/**
 * "Negocios similares" (ROADMAP W3-1) — same rubro and city as the listing
 * being viewed, barrio preferred. See `lib/similar.ts` for the ranking policy.
 *
 * A server component that fetches its own data, so it inherits the page's ISR
 * caching (`revalidate = 3600` on /lugar/[slug]) rather than adding a request-
 * time round-trip against an 8-connection pool.
 *
 * Renders nothing at all when there is no one to show. A "Negocios similares"
 * heading over an empty box tells a visitor the directory is thin, which on a
 * young directory is exactly the impression to avoid.
 */
export async function SimilarListings({ listing }: { listing: Listing }) {
  const { items } = await getListings(similarQuery(listing));
  const similar = rankSimilar(listing, items);
  if (similar.length === 0) return null;

  return (
    <section aria-labelledby="similares">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="similares" className="font-serif text-[21px] font-semibold">
          Negocios similares
        </h2>
        <Link
          href={`/${listing.categoria}/${listing.ciudad}`}
          className="text-[13px] font-semibold text-blue transition-colors hover:text-blued"
        >
          Ver todos en {listing.ciudadLabel}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {similar.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </section>
  );
}
