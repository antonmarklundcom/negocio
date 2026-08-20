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
  const t = await getTranslations({ locale, namespace: 'about' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor('/nosotros', locale),
  };
}

export default async function NosotrosPage(props: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  // ROADMAP W3-3: opts this route back into static rendering. Reading a
  // translation without it makes the route dynamic, which would quietly undo
  // W1-3's caching — the page would still be correct, just uncached.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'about' });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-8 md:py-16">
      <h1 className="font-serif text-[32px] font-semibold leading-tight md:text-[42px]">
        {t('heading')}
      </h1>
      <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-ink2">
        <p>
          {t('p1')}
        </p>
        <p>
          {t('p2')}
        </p>
        <p>
          {t('p3')}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/buscar" className="rounded-card bg-blue px-5 py-3 text-sm font-bold text-white hover:bg-blued">
          Explorar negocios
        </Link>
        <Link
          href="/sumar-negocio"
          className="rounded-card border-[1.5px] border-blue px-5 py-3 text-sm font-bold text-blue"
        >
          {t('cta')}
        </Link>
      </div>
    </div>
  );
}
