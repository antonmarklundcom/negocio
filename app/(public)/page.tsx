import Link from 'next/link';
import { getListings, getCategories } from '@/lib/listings-repo';
import { CategoryIcon, Search } from '@/components/icons';
import { ListingCard } from '@/components/ListingCard';
import { JsonLd, siteJsonLd } from '@/lib/jsonld';
import { MAX_FEATURED_SLOTS } from '@/lib/config';

export const revalidate = 3600;

export default async function HomePage() {
  const [categories, featured, destacadoPortada] = await Promise.all([
    getCategories(),
    getListings({ sort: 'destacados', premiumFirst: true, pageSize: 6, page: 1 }),
    // "Destacado en portada" (ROADMAP Phase D item 3) — a limited, separately
    // sold home-page slot, distinct from the general Premium pool above.
    getListings({ destacado: true, sort: 'nombre', pageSize: MAX_FEATURED_SLOTS, page: 1 }),
  ]);

  return (
    <div>
      <JsonLd data={siteJsonLd()} />

      {/* Hero */}
      <section className="border-b border-line bg-[linear-gradient(160deg,#FBF6EC,#F2E7D6)]">
        <div className="mx-auto max-w-content px-4 py-12 md:px-8 md:py-20">
          <h1 className="max-w-2xl font-serif text-[34px] font-semibold leading-[1.05] md:text-[52px]">
            Encontrá negocios de confianza cerca tuyo.
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink2 md:text-[18px]">
            Restaurantes, tiendas, servicios y profesionales en todo Paraguay. Buscá, comparás y contactás
            directo — gratis.
          </p>

          <form action="/buscar" className="mt-7 flex max-w-xl items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-card border border-line bg-paper px-4 py-3 shadow-card">
              <Search size={18} className="text-ink3" />
              <input
                name="q"
                placeholder="¿Qué estás buscando?"
                aria-label="Buscar negocios"
                className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink3"
              />
            </label>
            <button
              type="submit"
              className="rounded-card bg-blue px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-blued"
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      {/* Destacado en portada — a separately sold, limited slot (ROADMAP
          Phase D item 3), so it renders above the general Premium pool. */}
      {destacadoPortada.items.length > 0 && (
        <section className="mx-auto max-w-content px-4 pt-12 md:px-8">
          <h2 className="mb-6 font-serif text-[24px] font-semibold md:text-[28px]">Destacado en portada</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destacadoPortada.items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="mx-auto max-w-content px-4 py-12 md:px-8">
        <h2 className="mb-6 font-serif text-[24px] font-semibold md:text-[28px]">Explorá por rubro</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="group flex flex-col items-start gap-3 rounded-card border border-line bg-paper p-4 shadow-card transition-shadow hover:shadow-cardhover"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-terra2 text-terra">
                <CategoryIcon name={c.icon} size={22} />
              </span>
              <span className="text-[14px] font-semibold leading-snug text-ink group-hover:text-blued">
                {c.labelPlural}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.items.length > 0 && (
        <section className="mx-auto max-w-content px-4 pb-12 md:px-8">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-[24px] font-semibold md:text-[28px]">Negocios destacados</h2>
            <Link href="/buscar" className="text-sm font-semibold text-blue hover:text-blued">
              Ver todos
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* CTA band */}
      <section className="mx-auto max-w-content px-4 pb-16 md:px-8">
        <div className="rounded-card bg-ink p-8 md:flex md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="font-serif text-[26px] font-semibold text-white md:text-[32px]">
              ¿Tenés un negocio?
            </h2>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/70">
              Sumalo gratis y empezá a recibir clientes hoy. Pasá a Premium para fotos, WhatsApp y más
              visibilidad.
            </p>
          </div>
          <Link
            href="/sumar-negocio"
            className="mt-5 inline-block rounded-card bg-white px-6 py-3.5 text-sm font-bold text-ink md:mt-0"
          >
            Sumá tu negocio
          </Link>
        </div>
      </section>
    </div>
  );
}
