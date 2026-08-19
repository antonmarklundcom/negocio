import type { MetadataRoute } from 'next';
import {
  getListings,
  getCategoryCityCombosWithListings,
  getCategoryCityZonaCombosWithListings,
  getCategories,
} from '@/lib/listings-repo';
import { SITE_URL, listingPath } from '@/lib/config';
import { slugify } from '@/lib/format';

export const revalidate = 3600;

/** sitemap.xml generated from the listings repo (§9). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ items }, combos, zonaCombos, categories] = await Promise.all([
    getListings({ pageSize: 5000, page: 1 }),
    getCategoryCityCombosWithListings(),
    getCategoryCityZonaCombosWithListings(),
    getCategories(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = ['', '/buscar', '/rubros', '/precios', '/sumar-negocio', '/contacto', '/nosotros'].map(
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

  const barrioRoutes: MetadataRoute.Sitemap = zonaCombos.map((c) => ({
    url: `${SITE_URL}/${c.categoria}/${c.ciudad}/${slugify(c.zona)}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const listingRoutes: MetadataRoute.Sitemap = items.map((l) => ({
    url: `${SITE_URL}${listingPath(l.slug)}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...comboRoutes, ...barrioRoutes, ...listingRoutes];
}
