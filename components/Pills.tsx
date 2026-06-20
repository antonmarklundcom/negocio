import { Check } from './icons';

/** Verificado = bluebg / blued (§3). */
export function VerifiedPill({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bluebg px-2.5 py-1 text-[11px] font-bold text-blued">
      <Check size={11} />
      {!compact && 'Verificado'}
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
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-terra2 px-2.5 py-1 text-[11px] font-bold text-terra">
      ★ Destacado
    </span>
  );
}

/** "Abierto ahora" = terragold dot (§3). */
export function OpenNowPill({ closesAt }: { closesAt: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
      <span className="h-2 w-2 rounded-full bg-terragold shadow-[0_0_0_3px_rgba(194,151,47,.18)]" />
      Abierto ahora <span className="font-medium text-ink3">· cierra {closesAt}</span>
    </span>
  );
}

export function ClosedPill({ opensAt, dayLabel }: { opensAt?: string; dayLabel?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink3">
      <span className="h-2 w-2 rounded-full bg-ink3/40" />
      Cerrado
      {opensAt && (
        <span>
          · abre {dayLabel && dayLabel !== 'hoy' ? `${dayLabel} ` : ''}
          {opensAt}
        </span>
      )}
    </span>
  );
}
