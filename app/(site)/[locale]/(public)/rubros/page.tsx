import type { Metadata } from 'next';
import { Link } from '@/lib/i18n/link';
import { getCategories, getCategoryCityCombosWithListings } from '@/lib/listings-repo';
import { cityLabel } from '@/lib/cities';
import { CategoryIcon } from '@/components/icons';
import { Breadcrumb, type Crumb } from '@/components/Breadcrumb';
import { JsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/**
 * The real destination behind the mobile "Categorías" tab, which used to point
 * at `/precios` — a sales page, not a category index (ROADMAP W1-1).
 *
 * It is also the missing hub in the internal link graph: `/[categoria]` and
 * `/[categoria]/[ciudad]` landings were only reachable from the home page's
 * grid and the footer. Listing the live city combos under each rubro links
 * every one of them from a single crawlable page.
 */

export const revalidate = 3600;

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  const t = await getTranslations({ locale, namespace: 'rubros' });
  return {
    title: t('title'),
    description:
      t('description'),
    alternates: alternatesFor('/rubros', locale),
  };
}

export default async function RubrosPage(props: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  // ROADMAP W3-3: opts this route back into static rendering. Reading a
  // translation without it makes the route dynamic, which would quietly undo
  // W1-3's caching — the page would still be correct, just uncached.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'rubros' });

  const [categories, combos] = await Promise.all([getCategories(), getCategoryCityCombosWithListings()]);

  // Cities per rubro, in the provider's order, so each card links the landings
  // that actually have listings behind them and never a dead combo.
  const citiesByCategory = new Map<string, string[]>();
  for (const combo of combos) {
    const list = citiesByCategory.get(combo.categoria);
    if (list) list.push(combo.ciudad);
    else citiesByCategory.set(combo.categoria, [combo.ciudad]);
  }

  const crumbs: Crumb[] = [{ label: 'Inicio', href: '/' }, { label: 'Rubros' }];

  return (
    <div className="bg-cream">
      <JsonLd data={breadcrumbJsonLd(crumbs, locale)} />
      <div className="mx-auto max-w-content px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb items={crumbs} />

        <h1 className="mt-4 font-serif text-[28px] font-semibold leading-tight md:text-[38px]">
          {t('heading')}
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink2">
          {t('lead')}
        </p>

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const ciudades = citiesByCategory.get(c.slug) ?? [];
            return (
              <section
                key={c.slug}
                className="rounded-card border border-line bg-paper p-5 shadow-card"
              >
                <Link href={`/${c.slug}`} className="group flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terra2 text-terra">
                    <CategoryIcon name={c.icon} size={22} />
                  </span>
                  <h2 className="font-serif text-[19px] font-semibold leading-snug text-ink group-hover:text-blued">
                    {c.labelPlural}
                  </h2>
                </Link>

                {ciudades.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {ciudades.map((ciudad) => (
                      <li key={ciudad}>
                        <Link
                          href={`/${c.slug}/${ciudad}`}
                          className="inline-block rounded-full border border-line bg-cream px-3 py-1.5 text-[12px] font-semibold text-ink2 transition-colors hover:border-blue hover:text-blue"
                        >
                          {cityLabel(ciudad)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
