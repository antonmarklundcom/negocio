import type { MetadataRoute } from 'next';
import {
  getListings,
  getCategoryCityCombosWithListings,
  getCategoryCityZonaCombosWithListings,
  getCategories,
} from '@/lib/listings-repo';
import { listingPath } from '@/lib/config';
import { slugify } from '@/lib/format';
import { routing } from '@/lib/i18n/routing';
import { localeUrl } from '@/lib/i18n/alternates';

export const revalidate = 3600;

/**
 * sitemap.xml generated from the listings repo (§9), locale-aware since
 * ROADMAP W3-3 / D1.
 *
 * **One sitemap covering both locales, not one file per locale.** Every entry
 * is the default-locale URL carrying an `alternates.languages` map, which is
 * how Google is told the two URLs are the same page in different languages.
 * Emitting `/x` and `/en/x` as two independent, unrelated entries — the obvious
 * thing to do — asks the crawler to treat them as duplicate content and pick a
 * winner, which is the failure D1's hreflang decision exists to avoid.
 *
 * `x-default` is deliberately absent from these entries: it is expressed in each
 * page's `<head>` (see `lib/i18n/alternates.ts`), and the sitemap `languages`
 * map is a plain locale → URL mapping.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ items }, combos, zonaCombos, categories] = await Promise.all([
    getListings({ pageSize: 5000, page: 1 }),
    getCategoryCityCombosWithListings(),
    getCategoryCityZonaCombosWithListings(),
    getCategories(),
  ]);

  /**
   * One entry per path: the canonical (default-locale) URL, plus every other
   * locale as an alternate. The paths are the SAME in every locale — D1 keeps
   * slugs Spanish — so a single list of paths generates the whole thing and
   * there is no way for the two language trees to drift out of step.
   */
  const entry = (
    path: string,
    priority: number,
  ): MetadataRoute.Sitemap[number] => ({
    url: localeUrl(path, routing.defaultLocale),
    changeFrequency: 'weekly',
    priority,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, localeUrl(path, l)])),
    },
  });

  const staticRoutes = ['/', '/buscar', '/rubros', '/precios', '/sumar-negocio', '/contacto', '/nosotros'].map(
    (path) => entry(path, path === '/' ? 1 : 0.6),
  );

  const categoryRoutes = categories.map((c) => entry(`/${c.slug}`, 0.7));
  const comboRoutes = combos.map((c) => entry(`/${c.categoria}/${c.ciudad}`, 0.7));
  const barrioRoutes = zonaCombos.map((c) => entry(`/${c.categoria}/${c.ciudad}/${slugify(c.zona)}`, 0.6));
  const listingRoutes = items.map((l) => entry(listingPath(l.slug), 0.8));

  return [...staticRoutes, ...categoryRoutes, ...comboRoutes, ...barrioRoutes, ...listingRoutes];
}
