import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { routing, toLocale } from '@/lib/i18n/routing';

/**
 * Default social-share card (og:image + twitter:image). Auto-applied site-wide;
 * individual pages can still override via their own metadata. Matters a lot for
 * a directory whose links get shared on WhatsApp/Facebook.
 *
 * It lives INSIDE `[locale]` (ROADMAP W3-3/W3-4) for two reasons: at the app
 * root it had no layout to inherit `metadataBase` from and emitted no
 * `og:image` at all, and here it gets the segment, so the card is drawn in the
 * language of the page being shared. `middleware.ts` excludes
 * `opengraph-image` from locale rewriting so `/es/opengraph-image-<hash>` is
 * served directly — a 307 on an image URL is not followed by every scraper.
 */
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** The `alt` text also varies by locale — it is what a screen reader announces. */
export async function generateImageMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: 'og' });
  return [{ id: 'default', alt: t('alt'), size, contentType }];
}

export default async function OgImage({ params }: { params: Promise<{ locale: string }> }) {
  // `params` is a Promise in Next 16. Reading `params.locale` off the un-awaited
  // Promise silently yields `undefined`, `toLocale` falls back to Spanish, and
  // BOTH cards render in Spanish while their alt text is correctly translated —
  // which is exactly what happened before this await, and is invisible unless
  // you diff the two PNGs.
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: 'og' });
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
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 600, color: '#241E16' }}>
          negocio<span style={{ color: '#C2643E' }}>.com.py</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 68, fontWeight: 700, color: '#241E16', lineHeight: 1.1, maxWidth: 900 }}>
          {t('title')}
        </div>
        <div style={{ marginTop: 24, fontSize: 32, color: '#5B5246' }}>
          {t('subtitle')}
        </div>
      </div>
    ),
    { ...size },
  );
}
