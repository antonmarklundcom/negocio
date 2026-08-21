import { ImageResponse } from 'next/og';
import { getListingBySlug } from '@/lib/listings-repo';
import { categoryLabelFor } from '@/lib/categories';
import { toLocale } from '@/lib/i18n/routing';

/**
 * Per-listing social card.
 *
 * WHY THIS FILE EXISTS. The site-wide card at `[locale]/opengraph-image.tsx`
 * documents itself as "auto-applied site-wide; individual pages can still
 * override" — and for the listing page that was not true. Next merges metadata
 * *shallowly*, so `generateMetadata` returning an `openGraph` object replaced
 * the layout's outright, taking the inherited card with it. A business with no
 * cover photo therefore shared on WhatsApp with **no preview image at all**
 * (verified on a production build: `/lugar/mburicao-grill` emitted `og:title`
 * and `og:description` and nothing else). Roughly a third of the seed data has
 * no cover photo, and in production it is the *free* listings that lack one —
 * so the businesses least able to attract a click were the ones sharing as a
 * bare link.
 *
 * A file at this segment fixes it where a fallback URL could not: the generated
 * card's own URL is content-hashed (`/es/opengraph-image-<hash>/default?…`), so
 * it cannot be hardcoded, and pointing every listing at the generic site card
 * would waste the slot anyway. A card that names the business is worth more
 * than one that names the site.
 *
 * A listing WITH a cover photo still wins: `generateMetadata` sets
 * `openGraph.images` explicitly, which takes precedence over this file. This is
 * the fallback, not the default.
 */
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Rendered on demand, not prerendered for every listing at build time: the
 * card is only ever fetched when someone actually shares the link, and
 * pre-rendering one PNG per listing per locale would grow the build linearly
 * with the directory for images most of which are never requested.
 */
export const dynamicParams = true;
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  return [{ id: 'default', alt: listing?.name ?? 'negocio.com.py', size, contentType }];
}

export default async function ListingOgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);
  const listing = await getListingBySlug(slug);

  const name = listing?.name ?? 'negocio.com.py';
  const category = listing ? categoryLabelFor(listing.categoria, locale) : '';
  const where = listing ? (listing.zona ? `${listing.zona}, ${listing.ciudadLabel}` : listing.ciudadLabel) : '';
  const subtitle = [category, where].filter(Boolean).join(' · ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(150deg, #FBF6EC, #F2E7D6)',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 600, color: '#241E16' }}>
          negocio<span style={{ color: '#C2643E' }}>.com.py</span>
        </div>
        {/*
          Long business names are clamped rather than wrapped without limit: a
          five-line name would push the subtitle off a fixed-height canvas.
        */}
        <div
          style={{
            marginTop: 32,
            fontSize: 72,
            fontWeight: 700,
            color: '#241E16',
            lineHeight: 1.1,
            maxWidth: 1000,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {name}
        </div>
        {subtitle ? (
          <div style={{ marginTop: 28, fontSize: 34, color: '#5B5246' }}>{subtitle}</div>
        ) : null}
      </div>
    ),
    { ...size },
  );
}
