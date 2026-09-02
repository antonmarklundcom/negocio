import type { Metadata } from 'next';
import { Link } from '@/lib/i18n/link';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor('/terminos', locale),
  };
}

export default async function TerminosPage(props: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  // ROADMAP W3-3: opts this route back into static rendering. Reading a
  // translation without it makes the route dynamic, which would quietly undo
  // W1-3's caching — the page would still be correct, just uncached.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-8 md:py-16">
      {/* Placeholder legal copy — needs review before this is the site's actual legal text. See ROADMAP F12. */}
      <h1 className="font-serif text-[32px] font-semibold leading-tight md:text-[42px]">
        {t('heading')}
      </h1>
      <p className="mt-4 text-[14px] leading-relaxed text-ink2">{t('updated')}</p>

      <div className="mt-8 space-y-8 text-[16px] leading-relaxed text-ink2">
        <section>
          <h2 className="mb-2 text-[20px] font-semibold text-ink">{t('whatTitle')}</h2>
          <p>{t('whatBody')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-[20px] font-semibold text-ink">{t('dataTitle')}</h2>
          <p>{t('dataBody')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-[20px] font-semibold text-ink">{t('useTitle')}</h2>
          <p>{t('useBody')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-[20px] font-semibold text-ink">{t('reviewsTitle')}</h2>
          <p>{t('reviewsBody')}</p>
        </section>

        <section>
          <h2 className="mb-2 text-[20px] font-semibold text-ink">{t('contactTitle')}</h2>
          <p>
            {t('contactBody')}{' '}
            <Link href="/contacto" className="font-semibold text-blue hover:text-blued">
              {t('contactLink')}
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
