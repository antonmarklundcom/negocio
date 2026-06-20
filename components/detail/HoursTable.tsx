import type { DayHours } from '@/lib/types';
import { DAY_LABELS, formatRanges, nowInAsuncion } from '@/lib/hours';

/** Hours table with today highlighted (§6.1). Rows ordered from today onward. */
export function HoursTable({ hours }: { hours: DayHours[] }) {
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
              {isToday ? `Hoy · ${DAY_LABELS[d]}` : DAY_LABELS[d]}
            </span>
            <span className={dh ? '' : 'text-ink3'}>{formatRanges(dh)}</span>
          </div>
        );
      })}
    </div>
  );
}
