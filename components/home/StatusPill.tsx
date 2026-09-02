'use client';

import { useTranslations } from 'next-intl';
import type { OpenState } from '@/lib/hours';

/**
 * "Abierto ahora" / "Cerrado" pill for the home page's featured cards
 * (Home_A §4). Renders nothing for `{ unknown: true }` — never a fabricated
 * state (§6.5 elsewhere in the codebase).
 */
export function StatusPill({ open }: { open: OpenState }) {
  const tHours = useTranslations('hours');
  const tHome = useTranslations('home');

  if ('unknown' in open) return null;

  if (open.open) {
    return (
      <span className="inline-flex items-center gap-[6px] self-start rounded-full bg-terra2 px-[10px] py-1 text-[13px] font-semibold text-terrad">
        <span className="h-[7px] w-[7px] rounded-full bg-terra" />
        {tHours('openNow')} · {tHome('until', { time: open.closesAt })}
      </span>
    );
  }

  const when =
    open.opensAt == null
      ? null
      : open.opensWhen === 'today'
        ? tHome('opensToday', { time: open.opensAt })
        : open.opensWhen === 'tomorrow'
          ? tHome('opensTomorrow', { time: open.opensAt })
          : tHome('opensOnDay', { day: tHours(`days.${open.opensDay ?? 0}`), time: open.opensAt });

  return (
    <span className="inline-flex items-center gap-[6px] self-start rounded-full bg-cream2 px-[10px] py-1 text-[13px] font-semibold text-ink2">
      <span className="h-[7px] w-[7px] rounded-full bg-muted" />
      {tHours('closed')}
      {when && <> · {when}</>}
    </span>
  );
}
