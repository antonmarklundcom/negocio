import { nowInAsuncion } from '../hours';

/**
 * Open-now, expressed as data instead of as a clock read.
 *
 * The MySQL server's timezone is not ours and must never be trusted: the whole
 * "Abierto ahora" filter is defined in `America/Asuncion` wall-clock time. So
 * the app computes the current day + minute here and passes them into the
 * query as plain numbers. Nothing in `lib/db/` calls NOW() or CURDATE().
 */
export type WallClock = {
  /** 0 = Sunday … 6 = Saturday (JS getDay convention, as in `DayHours`). */
  day: number;
  /** Minutes since local midnight, 0..1439. */
  minutes: number;
};

export function wallClockNow(now: Date = new Date()): WallClock {
  return nowInAsuncion(now);
}

/** Yesterday's weekday, for ranges that started before midnight. */
export function previousDay(day: number): number {
  return (day + 6) % 7;
}

/**
 * The reference implementation of "is this range open at `at`", mirrored
 * one-for-one by the SQL in `lib/providers/db.ts`. Keeping it as a pure
 * function means the rule can be tested without MySQL and the SQL can be
 * checked against it.
 *
 * A range whose close is <= its open crosses midnight (23:00 → 02:00).
 */
export function isRangeOpenAt(
  range: { day: number; openMinute: number; closeMinute: number },
  at: WallClock,
): boolean {
  const crossesMidnight = range.closeMinute <= range.openMinute;

  if (range.day === at.day) {
    if (crossesMidnight) return at.minutes >= range.openMinute;
    return at.minutes >= range.openMinute && at.minutes < range.closeMinute;
  }

  // A range that started yesterday and has not closed yet.
  if (range.day === previousDay(at.day)) {
    return crossesMidnight && at.minutes < range.closeMinute;
  }

  return false;
}

export function isOpenAt(
  ranges: { day: number; openMinute: number; closeMinute: number }[],
  at: WallClock,
): boolean {
  return ranges.some((r) => isRangeOpenAt(r, at));
}

/** "HH:MM" (24h) → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
}

/** Minutes since midnight → "HH:MM" (24h). Inverse of `toMinutes`. */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
