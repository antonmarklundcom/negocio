import type { Metadata, Viewport } from 'next';
import { Newsreader, Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import { SITE_NAME, SITE_URL } from '@/lib/config';
import { Analytics } from '@/components/Analytics';

/**
 * The root layout owns only what EVERY route needs: `<html>`, fonts, global CSS
 * and analytics. The consumer chrome (header, footer, bottom nav, promo banner)
 * lives in `app/(public)/layout.tsx` instead, so `/admin` and `/ingresar` can
 * render their own chrome rather than inheriting a site header, a "Buscar"
 * bottom bar and a promo banner aimed at visitors.
 *
 * Route groups do not affect URLs: `app/(public)/buscar` is still `/buscar`.
 */

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-newsreader',
  display: 'swap',
});

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-hanken',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Encontrá negocios en Paraguay`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    'El directorio de negocios de Paraguay. Encontrá restaurantes, tiendas, servicios y profesionales cerca tuyo y contactalos al instante.',
  openGraph: {
    type: 'website',
    locale: 'es_PY',
    siteName: SITE_NAME,
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#F7F1E6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PY" className={`${newsreader.variable} ${hanken.variable}`}>
      <body className="min-h-screen bg-cream text-ink antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
