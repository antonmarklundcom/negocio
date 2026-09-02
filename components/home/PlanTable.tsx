import { Fragment } from 'react';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/i18n/routing';

type PlanRow = { f: string; free: boolean; prem: boolean };

/** "Qué incluye cada plan" comparison table (Home_A §7). */
export async function PlanTable({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const rows = t.raw('plan') as PlanRow[];

  return (
    <div className="rounded-[24px] border-[1.5px] border-line bg-paper p-7 shadow-panel">
      <div className="mb-[18px] text-[13px] font-semibold uppercase tracking-[0.06em] text-ink2">
        {t('planCaption')}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 gap-y-3 text-[15px]">
        <span />
        <span className="text-center text-[13px] font-semibold">{t('planFree')}</span>
        <span className="text-center text-[13px] font-semibold text-terrad">{t('planPremium')}</span>
        {rows.map((r) => (
          <Fragment key={r.f}>
            <span className="border-t border-line2 pt-3">{r.f}</span>
            <span className="border-t border-line2 pt-3 text-center text-ink2">{r.free ? t('yes') : '—'}</span>
            <span className="border-t border-line2 pt-3 text-center font-semibold text-terrad">
              {r.prem ? t('yes') : '—'}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
