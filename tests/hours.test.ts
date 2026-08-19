import { describe, expect, it } from 'vitest';
import { asuncionMonthRange, asuncionMonthRanges } from '@/lib/hours';

describe('asuncionMonthRange', () => {
  it('resolves the calendar month in America/Asuncion (UTC-3), not UTC', () => {
    // 2026-08-01T01:00:00Z is still July 31st in Asunción (UTC-3).
    const { start, end, monthLabel } = asuncionMonthRange(new Date('2026-08-01T01:00:00Z'));
    expect(start.toISOString()).toBe('2026-07-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-01T03:00:00.000Z');
    expect(monthLabel).toContain('julio');
  });

  it('rolls over into January of the next year at a December boundary', () => {
    const { start, end } = asuncionMonthRange(new Date('2026-12-15T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('the range is a half-open [start, end) covering the whole month', () => {
    const { start, end } = asuncionMonthRange(new Date('2026-02-15T12:00:00Z'));
    // Feb 2026 has 28 days.
    expect((end.getTime() - start.getTime()) / (24 * 3600 * 1000)).toBe(28);
  });
});

describe('asuncionMonthRanges (ROADMAP W2-5)', () => {
  it('returns the requested number of months, oldest first, ending with the current one', () => {
    const ranges = asuncionMonthRanges(6, new Date('2026-08-19T15:00:00Z'));
    expect(ranges).toHaveLength(6);
    expect(ranges.map((r) => r.monthLabel)).toEqual([
      'marzo de 2026',
      'abril de 2026',
      'mayo de 2026',
      'junio de 2026',
      'julio de 2026',
      'agosto de 2026',
    ]);
  });

  it('each range starts exactly where the previous one ends — no gaps, no overlap', () => {
    const ranges = asuncionMonthRanges(4, new Date('2026-08-19T15:00:00Z'));
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]!.start.getTime()).toBe(ranges[i - 1]!.end.getTime());
    }
  });

  it('crosses a year boundary without skipping December', () => {
    const ranges = asuncionMonthRanges(3, new Date('2026-02-10T15:00:00Z'));
    expect(ranges.map((r) => r.monthLabel)).toEqual([
      'diciembre de 2025',
      'enero de 2026',
      'febrero de 2026',
    ]);
  });

  it('steps back over February without landing on the wrong month', () => {
    // The reason the implementation walks back one second from each month's
    // start instead of subtracting a fixed 30 days: from 31 March, minus 30
    // days lands in March again and February is skipped entirely.
    const ranges = asuncionMonthRanges(3, new Date('2026-03-31T15:00:00Z'));
    expect(ranges.map((r) => r.monthLabel)).toEqual([
      'enero de 2026',
      'febrero de 2026',
      'marzo de 2026',
    ]);
  });

  it('returns nothing for a count of zero', () => {
    expect(asuncionMonthRanges(0, new Date('2026-08-19T15:00:00Z'))).toEqual([]);
  });
});
