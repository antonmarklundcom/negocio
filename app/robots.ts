import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    // The admin also carries `robots: { index: false }` on every route — this is
    // the crawler-facing half of the same rule, not a replacement for it.
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/ingresar', '/cambiar-contrasena'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
