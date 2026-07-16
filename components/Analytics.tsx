import Script from 'next/script';
import { PLAUSIBLE_DOMAIN } from '@/lib/config';

/**
 * Cookieless visitor analytics (Plausible). Off until NEXT_PUBLIC_PLAUSIBLE_DOMAIN
 * is set — no script loads, no cookie banner needed either way. Self-hosted
 * Plausible works too: set NEXT_PUBLIC_PLAUSIBLE_SRC to the custom script URL.
 */
export function Analytics() {
  if (!PLAUSIBLE_DOMAIN) return null;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js';
  return <Script defer data-domain={PLAUSIBLE_DOMAIN} src={src} strategy="afterInteractive" />;
}
