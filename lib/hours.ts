import type { DayHours } from './types';
import { TIMEZONE } from './config';

export const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export type OpenState =
  | { open: true; closesAt: string }
  | { open: false; opensAt?: string; opensDayLabel?: string }
  | { unknown: true };

/** Current wall-clock day/minute in America/Asuncion, independent of server TZ. */
export function nowInAsuncion(now: Date = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const weekdayIndex: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const day = weekdayIndex[map.weekday ?? 'Sun'] ?? 0;
  let hour = parseInt(map.hour ?? '0', 10);
  if (hour === 24) hour = 0; // some runtimes emit "24" at midnight
  const minutes = hour * 60 + parseInt(map.minute ?? '0', 10);
  return { day, minutes };
}

/** Asunción is UTC-3 year-round (DST was abolished in 2024) — see README → Database. */
const ASUNCION_UTC_OFFSET_HOURS = 3;

/**
 * The current calendar month's `[start, end)` boundaries as UTC instants,
 * computed from the `America/Asuncion` wall clock — for the monthly lead
 * report (ROADMAP Phase D item 1). Pure over `now`, so it is unit-testable
 * without waiting for a real month boundary.
 */
export function asuncionMonthRange(now: Date = new Date()): { start: Date; end: Date; monthLabel: string } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit' }).formatToParts(
    now,
  );
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const year = parseInt(map.year ?? '1970', 10);
  const month = parseInt(map.month ?? '1', 10); // 1-12

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) + ASUNCION_UTC_OFFSET_HOURS * 3600 * 1000);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0) + ASUNCION_UTC_OFFSET_HOURS * 3600 * 1000);

  const monthLabel = new Intl.DateTimeFormat('es-PY', { timeZone: TIMEZONE, month: 'long', year: 'numeric' }).format(now);

  return { start, end, monthLabel };
}

/**
 * The last `count` months in America/Asunción, oldest first, each as the same
 * `[start, end)` pair `asuncionMonthRange` produces (ROADMAP W2-5).
 *
 * Pure and clock-injectable, like everything else in this file: the renewal
 * conversation ("you got 47 WhatsApp taps last month, 12 the month before")
 * is only credible if the boundaries are the same ones the monthly number
 * already uses, and only testable if `now` is a parameter.
 */
export function asuncionMonthRanges(
  count: number,
  now: Date = new Date(),
): { start: Date; end: Date; monthLabel: string }[] {
  const ranges: { start: Date; end: Date; monthLabel: string }[] = [];
  let cursor = now;
  for (let i = 0; i < count; i++) {
    const range = asuncionMonthRange(cursor);
    ranges.push(range);
    // One second before this month starts is somewhere inside the previous
    // month, in every timezone and across every year boundary. Subtracting a
    // fixed 30 days would skip February.
    cursor = new Date(range.start.getTime() - 1000);
  }
  return ranges.reverse();
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
}

function dayHoursFor(hours: DayHours[], day: number): DayHours | undefined {
  return hours.find((h) => h.day === day);
}

/**
 * Compute open/closed for a set of structured hours. Ranges where close <= open
 * are treated as crossing midnight. Returns `{ unknown: true }` when there are
 * no hours so the UI can show nothing (never a fabricated state, §6.5).
 */
export function computeOpenState(hours: DayHours[] | undefined, now: Date = new Date()): OpenState {
  if (!hours || hours.length === 0) return { unknown: true };
  const { day, minutes } = nowInAsuncion(now);

  // Today's ranges, including any from yesterday that cross midnight.
  const today = dayHoursFor(hours, day);
  if (today) {
    for (const r of today.ranges) {
      const open = toMin(r.open);
      const close = toMin(r.close);
      if (close > open) {
        if (minutes >= open && minutes < close) return { open: true, closesAt: r.close };
      } else {
        // crosses midnight: open today until close tomorrow
        if (minutes >= open) return { open: true, closesAt: r.close };
      }
    }
  }
  const yesterday = dayHoursFor(hours, (day + 6) % 7);
  if (yesterday) {
    for (const r of yesterday.ranges) {
      const open = toMin(r.open);
      const close = toMin(r.close);
      if (close <= open && minutes < close) return { open: true, closesAt: r.close };
    }
  }

  // Closed now — find the next opening within the next 7 days.
  for (let i = 0; i < 7; i++) {
    const d = (day + i) % 7;
    const dh = dayHoursFor(hours, d);
    if (!dh) continue;
    for (const r of [...dh.ranges].sort((a, b) => toMin(a.open) - toMin(b.open))) {
      const open = toMin(r.open);
      if (i === 0 && open <= minutes) continue;
      return {
        open: false,
        opensAt: r.open,
        opensDayLabel: i === 0 ? 'hoy' : i === 1 ? 'mañana' : DAY_LABELS[d],
      };
    }
  }
  return { open: false };
}

/** "11:00 – 15:00 · 19:00 – 23:00" for one day's ranges. */
export function formatRanges(dh: DayHours | undefined): string {
  if (!dh || dh.ranges.length === 0) return 'Cerrado';
  return dh.ranges.map((r) => `${r.open} – ${r.close}`).join(' · ');
}

/** openingHours strings for schema.org (e.g. "Mo-Sa 11:00-15:00"). */
const SCHEMA_DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export function toSchemaOpeningHours(hours: DayHours[] | undefined): string[] {
  if (!hours) return [];
  const out: string[] = [];
  for (const dh of hours) {
    for (const r of dh.ranges) {
      out.push(`${SCHEMA_DAY[dh.day]} ${r.open}-${r.close}`);
    }
  }
  return out;
}
