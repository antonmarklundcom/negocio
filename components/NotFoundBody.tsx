'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/link';

/**
 * The 404 block itself — no header, no footer.
 *
 * KNOWN LIMITATION, deliberately accepted (ROADMAP W3-4): this always renders
 * in the DEFAULT locale, so `/en/nada` shows an English header around a Spanish
 * 404 body.
 *
 * `not-found.tsx` receives no props, so the only way to make it locale-aware is
 * a copy inside the `[locale]` segment reading the provider. That was built and
 * measured, and it costs more than it buys: the response then carried two
 * conflicting 404 headings (Next resolves the outer not-found as well), and
 * `/nada` stopped being byte-identical to `/admin` — which is a stated security
 * decision ("`/admin` 404s for the unauthorised, not 403" is worth nothing if
 * the two are distinguishable). A Spanish sentence on an error page is the
 * cheaper defect. Revisit if Next gives `not-found.tsx` access to params.
 */
export function NotFoundBody() {
  const t = useTranslations('notFound');
  return (
    <div className="mx-auto flex max-w-content flex-col items-center px-4 py-24 text-center md:px-8">
      <div className="font-serif text-[80px] font-semibold leading-none text-terra">404</div>
      <h1 className="mt-4 font-serif text-[26px] font-semibold">{t('heading')}</h1>
      <p className="mt-2 max-w-md text-[15px] text-ink2">{t('lead')}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-card bg-blue px-5 py-3 text-sm font-bold text-white hover:bg-blued">
          {t('home')}
        </Link>
        <Link href="/buscar" className="rounded-card border-[1.5px] border-blue px-5 py-3 text-sm font-bold text-blue">
          {t('search')}
        </Link>
      </div>
    </div>
  );
}
