import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/link';
import { LanguageSwitcherSlot } from './LanguageSwitcher';
import type { Locale } from '@/lib/i18n/routing';

export async function Footer({ locale }: { locale: Locale }) {
  // Explicit locale — see the note in (site)/[locale]/layout.tsx.
  const t = await getTranslations({ locale, namespace: 'footer' });

  return (
    <footer className="mt-16 border-t-[1.5px] border-line bg-cream2">
      <div className="mx-auto grid max-w-wide gap-8 px-4 pb-8 pt-12 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-10">
        <div>
          <div className="font-serif text-[24px] font-medium tracking-[-0.01em] text-ink">
            negocio<span className="text-terra">.</span>com.py
          </div>
          <p className="mt-2.5 max-w-[280px] text-[14px] leading-[1.5] text-ink2">{t('tagline')}</p>
          <LanguageSwitcherSlot className="mt-4" />
        </div>

        <div className="flex flex-col gap-[10px] text-[14px]">
          <span className="mb-1 font-semibold text-ink">{t('sections.explore')}</span>
          <Link href="/rubros" className="text-ink hover:text-blued">
            {t('categories')}
          </Link>
          <Link href="/buscar" className="text-ink hover:text-blued">
            {t('cities')}
          </Link>
          <Link href="/buscar?abierto=1" className="text-ink hover:text-blued">
            {t('openNow')}
          </Link>
          <Link href="/buscar?sort=destacados" className="text-ink hover:text-blued">
            {t('featured')}
          </Link>
        </div>

        <div className="flex flex-col gap-[10px] text-[14px]">
          <span className="mb-1 font-semibold text-ink">{t('sections.business')}</span>
          <Link href="/sumar-negocio" className="text-ink hover:text-blued">
            {t('publishFree')}
          </Link>
          <Link href="/precios" className="text-ink hover:text-blued">
            {t('premium')}
          </Link>
          <Link href="/nosotros" className="text-ink hover:text-blued">
            {t('about')}
          </Link>
        </div>

        <div className="flex flex-col gap-[10px] text-[14px]">
          <span className="mb-1 font-semibold text-ink">{t('sections.help')}</span>
          <Link href="/contacto" className="text-ink hover:text-blued">
            {t('contact')}
          </Link>
          <Link href="/favoritos" className="text-ink hover:text-blued">
            {t('myFavorites')}
          </Link>
        </div>
      </div>
      <div className="mx-auto flex max-w-wide flex-col justify-between gap-2 px-4 pb-7 text-[13px] text-ink2 sm:flex-row md:px-10">
        <span>
          © {new Date().getFullYear()} negocio.com.py · Asunción, Paraguay
        </span>
        <span>{t('note')}</span>
      </div>
    </footer>
  );
}
