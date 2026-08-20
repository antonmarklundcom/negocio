import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/i18n/routing';
import type { Listing } from '@/lib/types';
import { categoryBlockKind } from '@/lib/categories';
import { mediaUrl } from '@/lib/media/url';
import { WhatsAppButton } from './WhatsAppButton';

/**
 * The swappable premium "category block" (§6.4). One component switches on the
 * category's blockKind and renders ONLY the sections that have data. The
 * reference's restaurant content is just the `food` instance — generalised here.
 */
export function CategoryBlock({ listing, locale }: { listing: Listing; locale: Locale }) {
  const kind = categoryBlockKind(listing.categoria);

  if (kind === 'food') return <FoodBlock listing={listing} locale={locale} />;
  if (kind === 'shop') return <ShopBlock listing={listing} locale={locale} />;
  if (kind === 'service') return <ServiceBlock listing={listing} locale={locale} />;
  return <DefaultBlock listing={listing} locale={locale} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-serif text-[21px] font-semibold">{children}</h2>;
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span
          key={s}
          className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink2"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

async function FoodBlock({ listing, locale }: { listing: Listing; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'blocks' });
  const { especialidades, destacadoItem } = listing;
  if (!especialidades?.length && !destacadoItem) return null;
  return (
    <section>
      {especialidades?.length ? (
        <>
          <SectionTitle>{t('especialidades')}</SectionTitle>
          <Chips items={especialidades} />
        </>
      ) : null}
      {destacadoItem && (
        <div className="mt-6 flex items-center gap-4 rounded-card bg-terra2 px-5 py-4">
          {destacadoItem.image && (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
              <Image src={mediaUrl(destacadoItem.image)} alt={destacadoItem.title} fill sizes="64px" className="object-cover" />
            </div>
          )}
          <div className="flex-1">
            <div className="text-[15px] font-bold">{destacadoItem.title}</div>
            {destacadoItem.desc && <div className="text-[13px] text-ink2">{destacadoItem.desc}</div>}
          </div>
          {destacadoItem.price && (
            <div className="font-serif text-2xl font-semibold text-terra">{destacadoItem.price}</div>
          )}
        </div>
      )}
    </section>
  );
}

async function ShopBlock({ listing, locale }: { listing: Listing; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'blocks' });
  const { productos } = listing;
  if (!productos?.length) return null;
  return (
    <section>
      <SectionTitle>{t('productos')}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {productos.map((p) => (
          <div key={p.title} className="overflow-hidden rounded-card border border-line bg-paper">
            <div className="relative h-24 w-full">
              {p.image ? (
                <Image src={mediaUrl(p.image)} alt={p.title} fill sizes="160px" className="object-cover" />
              ) : (
                <div className="h-full w-full bg-[linear-gradient(150deg,#F4E3D6,#E9D2BE)]" />
              )}
            </div>
            <div className="p-3">
              <div className="text-[13px] font-semibold leading-snug">{p.title}</div>
              {p.price && <div className="mt-1 font-serif text-base font-semibold text-terra">{p.price}</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

async function ServiceBlock({ listing, locale }: { listing: Listing; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'blocks' });
  const { servicios, especialidades } = listing;
  if (!servicios?.length && !especialidades?.length) return null;
  return (
    <section>
      <SectionTitle>{t('servicios')}</SectionTitle>
      {especialidades?.length ? (
        <div className="mb-4">
          <Chips items={especialidades} />
        </div>
      ) : null}
      {servicios?.length ? (
        <ul className="divide-y divide-line2 overflow-hidden rounded-card border border-line bg-paper">
          {servicios.map((s) => (
            <li key={s.title} className="px-4 py-3">
              <div className="text-[14px] font-semibold">{s.title}</div>
              {s.desc && <div className="text-[13px] text-ink2">{s.desc}</div>}
            </li>
          ))}
        </ul>
      ) : null}
      {listing.whatsapp && (
        <div className="mt-4">
          <WhatsAppButton
            whatsapp={listing.whatsapp}
            listingId={listing.id}
            slug={listing.slug}
            name={listing.name}
            label="Pedir presupuesto"
          />
        </div>
      )}
    </section>
  );
}

async function DefaultBlock({ listing, locale }: { listing: Listing; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'blocks' });
  const { especialidades } = listing;
  if (!especialidades?.length) return null;
  return (
    <section>
      <SectionTitle>{t('informacion')}</SectionTitle>
      <Chips items={especialidades} />
    </section>
  );
}
