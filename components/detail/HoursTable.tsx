import type { DayHours } from '@/lib/types';
import { getTranslations } from 'next-intl/server';
import { formatRanges, nowInAsuncion } from '@/lib/hours';
import type { Locale } from '@/lib/i18n/routing';

/** Hours table with today highlighted (§6.1). Rows ordered from today onward. */
export async function HoursTable({ hours, locale }: { hours: DayHours[]; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'hours' });
  const { day: today } = nowInAsuncion();
  const order = Array.from({ length: 7 }, (_, i) => ((today + i) % 7) as DayHours['day']);
  const byDay = new Map(hours.map((h) => [h.day, h]));

  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      {order.map((d, i) => {
        const dh = byDay.get(d);
        const isToday = i === 0;
        return (
          <div
            key={d}
            className={`flex items-center justify-between px-4 py-2.5 text-[13px] ${
              isToday ? 'bg-cream2 font-semibold' : 'border-t border-line2 text-ink2'
            }`}
          >
            <span className={isToday ? 'font-bold' : ''}>
              {isToday ? t('todayIs', { day: t(`days.${d}`) }) : t(`days.${d}`)}
            </span>
            <span className={dh ? '' : 'text-ink3'}>{formatRanges(dh) ?? t('closedThatDay')}</span>
          </div>
        );
      })}
    </div>
  );
}
