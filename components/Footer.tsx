import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/link';
import { CATEGORIES } from '@/lib/categories';
import { LanguageSwitcherSlot } from './LanguageSwitcher';
import { categoryLabelPluralFor } from '@/lib/categories';
import type { Locale } from '@/lib/i18n/routing';

export async function Footer({ locale }: { locale: Locale }) {
  // Explicit locale — see the note in (site)/[locale]/layout.tsx.
  const t = await getTranslations({ locale, namespace: 'footer' });

  return (
    <footer className="mt-16 border-t border-line bg-cream2/60">
      <div className="mx-auto grid max-w-content gap-8 px-4 py-12 md:grid-cols-4 md:px-8">
        <div>
          <div className="font-serif text-xl font-semibold">
            negocio<span className="text-terra">.com.py</span>
          </div>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink2">
            {t('tagline')}
          </p>
          <LanguageSwitcherSlot className="mt-4" />
        </div>

        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-ink3">{t('sections.rubros')}</div>
          <ul className="space-y-2 text-sm text-ink2">
            {CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`} className="hover:text-ink">
                  {categoryLabelPluralFor(c.slug, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-ink3">{t('sections.business')}</div>
          <ul className="space-y-2 text-sm text-ink2">
            <li>
              <Link href="/precios" className="hover:text-ink">
                {t('prices')}
              </Link>
            </li>
            <li>
              <Link href="/sumar-negocio" className="hover:text-ink">
                {t('addBusiness')}
              </Link>
            </li>
            <li>
              <Link href="/nosotros" className="hover:text-ink">
                {t('about')}
              </Link>
            </li>
            <li>
              <Link href="/contacto" className="hover:text-ink">
                {t('contact')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-ink3">{t('sections.search')}</div>
          <ul className="space-y-2 text-sm text-ink2">
            <li>
              <Link href="/buscar" className="hover:text-ink">
                Todos los negocios
              </Link>
            </li>
            <li>
              <Link href="/restaurantes/asuncion" className="hover:text-ink">
                Restaurantes en Asunción
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-ink3">
        © {new Date().getFullYear()} negocio.com.py · Paraguay
      </div>
    </footer>
  );
}
