import type { Metadata } from 'next';
import { Link } from '@/lib/i18n/link';
import { Check } from '@/components/icons';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor('/precios', locale),
  };
}

export default async function PreciosPage(props: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  // ROADMAP W3-3: opts this route back into static rendering. Reading a
  // translation without it makes the route dynamic, which would quietly undo
  // W1-3's caching — the page would still be correct, just uncached.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'pricing' });

  return (
    <div className="mx-auto max-w-content px-4 py-10 md:px-8 md:py-14">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-[32px] font-semibold leading-tight md:text-[40px]">
          {t('heading')}
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink2">
          {t('lead')}
        </p>
      </header>

      <div className="mx-auto mt-10 grid max-w-3xl gap-5 md:grid-cols-2">
        {/* Gratis */}
        <div className="flex flex-col rounded-card border border-line bg-paper p-7 shadow-card">
          <div className="text-[13px] font-bold uppercase tracking-wider text-ink3">{t('free')}</div>
          <div className="mt-2 font-serif text-[34px] font-semibold">{t('freePrice')}</div>
          <p className="mt-1 text-sm text-ink2">{t('freeNote')}</p>
          <ul className="mt-5 flex-1 space-y-3">
            {t.raw('freeFeatures').map((f: string) => (
              <li key={f} className="flex items-start gap-2 text-[14px] text-ink2">
                <Check size={16} className="mt-0.5 shrink-0 text-blue" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/sumar-negocio"
            className="mt-6 rounded-card border-[1.5px] border-blue py-3 text-center text-sm font-bold text-blue"
          >
            {t('freeCta')}
          </Link>
        </div>

        {/* Premium */}
        <div className="flex flex-col rounded-card border border-terra2 border-t-[2.5px] border-t-terra bg-paper p-7 shadow-premium">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold uppercase tracking-wider text-terra">{t('premium')}</span>
            <span className="rounded-full bg-terra2 px-2.5 py-0.5 text-[11px] font-bold text-terra">{t('recommended')}</span>
          </div>
          <div className="mt-2 font-serif text-[34px] font-semibold">
            {t('premiumPrice')}
            <span className="text-[16px] font-medium text-ink3">{t('perMonth')}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-terrad">
            {t('premiumAnnualPrice')}
            <span className="ml-1.5 font-normal text-ink3">({t('premiumAnnualNote')})</span>
          </p>
          <p className="mt-1 text-sm text-ink2">{t('premiumNote')}</p>
          <ul className="mt-5 flex-1 space-y-3">
            {t.raw('premiumFeatures').map((f: string) => (
              <li key={f} className="flex items-start gap-2 text-[14px] text-ink2">
                <Check size={16} className="mt-0.5 shrink-0 text-terra" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/sumar-negocio"
            className="mt-6 rounded-card bg-blue py-3 text-center text-sm font-bold text-white transition-colors hover:bg-blued"
          >
            {t('premiumCta')}
          </Link>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-ink2">
        {t('verifiedAddon')}{' '}
        <Link href="/contacto" className="font-semibold text-blue">
          {t('verifiedAddonCta')}
        </Link>
      </p>

      <p className="mt-8 text-center text-xs text-ink3">
        {t('footnote')}
      </p>
    </div>
  );
}
