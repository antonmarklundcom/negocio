import type { MetadataRoute } from 'next';
import { getListings, getCategoryCityCombosWithListings, getCategories } from '@/lib/listings-repo';
import { SITE_URL, listingPath } from '@/lib/config';

export const revalidate = 3600;

/** sitemap.xml generated from the listings repo (§9). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ items }, combos, categories] = await Promise.all([
    getListings({ pageSize: 5000, page: 1 }),
    getCategoryCityCombosWithListings(),
    getCategories(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = ['', '/buscar', '/precios', '/sumar-negocio', '/contacto', '/nosotros'].map(
    (path) => ({ url: `${SITE_URL}${path}`, changeFrequency: 'weekly', priority: path === '' ? 1 : 0.6 }),
  );

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/${c.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const comboRoutes: MetadataRoute.Sitemap = combos.map((c) => ({
    url: `${SITE_URL}/${c.categoria}/${c.ciudad}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const listingRoutes: MetadataRoute.Sitemap = items.map((l) => ({
    url: `${SITE_URL}${listingPath(l.slug)}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...comboRoutes, ...listingRoutes];
}
