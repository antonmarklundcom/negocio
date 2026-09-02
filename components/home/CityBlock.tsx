import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/link';
import type { City } from '@/lib/types';
import type { Locale } from '@/lib/i18n/routing';

/** "Buscá por ciudad" panel (Home_A §6). */
export async function CityBlock({ locale, cities }: { locale: Locale; cities: City[] }) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section id="ciudades" className="mx-auto max-w-wide px-4 pb-14 pt-10 md:px-10">
      <div className="grid items-start gap-6 rounded-[24px] bg-cream2 p-6 md:grid-cols-[320px_1fr] md:gap-10 md:p-10">
        <div>
          <h2 className="mb-[6px] font-serif text-[28px] font-medium tracking-[-0.015em] md:text-[34px]">
            {t('browseByCity')}
          </h2>
          <p className="text-[15px] leading-[1.5] text-ink2">{t('cityLead')}</p>
        </div>
        <div className="flex flex-wrap gap-[10px]">
          {cities.map((c) => (
            <Link
              key={c.slug}
              href={`/buscar?ciudad=${c.slug}`}
              className="rounded-full border-[1.5px] border-line bg-paper px-[18px] py-[10px] text-[15px] font-medium text-ink no-underline hover:border-ink"
            >
              {c.label}
            </Link>
          ))}
          <Link
            href="/buscar"
            className="rounded-full px-[18px] py-[10px] text-[15px] font-semibold text-blue no-underline"
          >
            {t('allCities')}
          </Link>
        </div>
      </div>
    </section>
  );
}
