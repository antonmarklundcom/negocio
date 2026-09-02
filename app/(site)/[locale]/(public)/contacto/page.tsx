import type { Metadata } from 'next';
import { ContactoForm } from '@/components/ContactoForm';
import { WhatsApp } from '@/components/icons';
import { PLATFORM_WHATSAPP } from '@/lib/config';
import { waLink } from '@/lib/format';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  const t = await getTranslations({ locale, namespace: 'contact' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor('/contacto', locale),
  };
}

export default async function ContactoPage(props: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  // ROADMAP W3-3: opts this route back into static rendering. Reading a
  // translation without it makes the route dynamic, which would quietly undo
  // W1-3's caching — the page would still be correct, just uncached.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <div className="mx-auto max-w-content px-4 py-10 md:px-8 md:py-14">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h1 className="font-serif text-[32px] font-semibold leading-tight md:text-[40px]">{t('heading')}</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink2">
            {t('lead')}
          </p>
          <a
            href={waLink(PLATFORM_WHATSAPP, t('whatsappMessage'))}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-card bg-wa px-5 py-3 text-[15px] font-bold text-white shadow-wa transition-colors hover:bg-wab"
          >
            <WhatsApp size={19} />
            {t('whatsappCta')}
          </a>
        </div>

        <div className="rounded-card border border-line bg-paper p-6 shadow-card md:p-7">
          <h2 className="mb-5 font-serif text-[22px] font-semibold">{t('formHeading')}</h2>
          <ContactoForm />
        </div>
      </div>
    </div>
  );
}
