import type { Metadata, Viewport } from 'next';
import '../globals.css';
import { FONT_VARIABLES } from '@/lib/fonts';
import { defaultMetadata } from '@/lib/i18n/metadata';

/**
 * Root layout for the **staff panel** — `/admin`, `/ingresar`,
 * `/cambiar-contrasena`.
 *
 * A second root layout, not a nested one (ROADMAP W3-3). The public site's root
 * lives at `app/(site)/[locale]/layout.tsx` and takes its `lang` from the URL
 * segment; the panel has no locale segment because it is Spanish-only by
 * decision (see `middleware.ts`), and giving it its own `<html>` is what lets
 * the public one be locale-aware **without** reading a dynamic request API in a
 * shared root — which would have opted every ISR'd public page back into
 * dynamic rendering.
 *
 * Route groups do not affect URLs: `app/(panel)/admin` is still `/admin`.
 *
 * No `<Analytics />` here on purpose: the panel is staff, not audience, and its
 * page views are not a product metric.
 */
/**
 * The SAME defaults the public site uses, deliberately (lib/i18n/metadata.ts).
 *
 * The only page in this tree an anonymous visitor can reach is the 404 — every
 * real route 404s for them — and that 404 must be indistinguishable from any
 * other missing page. A `<title>Panel</title>` here would have confirmed the
 * panel exists to anyone who ran `curl /admin`. The pages staff actually reach
 * are marked noindex by `admin/layout.tsx` and `(auth)/layout.tsx`.
 */
export const metadata: Metadata = defaultMetadata();

export const viewport: Viewport = {
  themeColor: '#F7F1E6',
  width: 'device-width',
  initialScale: 1,
};

export default function PanelRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PY" className={FONT_VARIABLES}>
      <body className="min-h-screen bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
