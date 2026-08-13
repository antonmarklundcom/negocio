import { describe, expect, it } from 'vitest';
import { asuncionMonthRange } from '@/lib/hours';

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
