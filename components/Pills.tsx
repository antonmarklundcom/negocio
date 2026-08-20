'use client';

import { useTranslations } from 'next-intl';
import { Check } from './icons';

/** Verificado = bluebg / blued (§3). */
export function VerifiedPill({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('pills');
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bluebg px-2.5 py-1 text-[11px] font-bold text-blued">
      <Check size={11} />
      {!compact && t('verified')}
    </span>
  );
}

/** Category chip = white + line (§3). */
export function CategoryChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink2">
      {label}
    </span>
  );
}

/** Destacado = terra2 / terra with a ★ (§3). */
export function DestacadoPill() {
  const t = useTranslations('pills');
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-terra2 px-2.5 py-1 text-[11px] font-bold text-terra">
      {t('featured')}
    </span>
  );
}

/** "Abierto ahora" = terragold dot (§3). */
export function OpenNowPill({ closesAt }: { closesAt: string }) {
  const t = useTranslations('hours');
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
      <span className="h-2 w-2 rounded-full bg-terragold shadow-[0_0_0_3px_rgba(194,151,47,.18)]" />
      {t('openNow')} <span className="font-medium text-ink3">{t('closesAt', { time: closesAt })}</span>
    </span>
  );
}

export function ClosedPill({
  opensAt,
  opensDay,
  opensWhen,
}: {
  opensAt?: string;
  opensDay?: number;
  opensWhen?: 'today' | 'tomorrow' | 'later';
}) {
  const t = useTranslations('hours');
  // Three separate messages rather than one with an inserted day name: "opens
  // tomorrow at 8" and "opens Monday at 8" are not the same sentence in every
  // language, and gluing a translated day into a translated fragment is how a
  // translation ends up ungrammatical in exactly the language nobody here reads.
  const when =
    opensAt == null
      ? null
      : opensWhen === 'today'
        ? t('opensToday', { time: opensAt })
        : opensWhen === 'tomorrow'
          ? t('opensTomorrow', { time: opensAt })
          : t('opensOnDay', { day: t(`days.${opensDay ?? 0}`), time: opensAt });

  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink3">
      <span className="h-2 w-2 rounded-full bg-ink3/40" />
      {t('closed')}
      {when && <span>{when}</span>}
    </span>
  );
}
