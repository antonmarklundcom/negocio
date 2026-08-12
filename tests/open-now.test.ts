import { describe, expect, it } from 'vitest';
import {
  isOpenAt,
  isRangeOpenAt,
  previousDay,
  toHHMM,
  toMinutes,
  wallClockNow,
} from '../lib/db/open-now';
import { computeOpenState } from '../lib/hours';
import { dayHoursToRows } from '../lib/db/mappers';
import type { DayHours } from '../lib/types';

describe('wallClockNow', () => {
  // Paraguay is UTC-3 year-round (DST was abolished in 2024).
  it('reads America/Asuncion wall clock, not the process timezone', () => {
    // 2026-08-12 is a Wednesday; 15:30 UTC is 12:30 in Asunción.
    const at = wallClockNow(new Date('2026-08-12T15:30:00Z'));
    expect(at.day).toBe(3);
    expect(at.minutes).toBe(12 * 60 + 30);
  });

  it('rolls back to the previous day when Asunción is still on the day before', () => {
    // 02:00 UTC Thursday is 23:00 Wednesday in Asunción.
    const at = wallClockNow(new Date('2026-08-13T02:00:00Z'));
    expect(at.day).toBe(3);
    expect(at.minutes).toBe(23 * 60);
  });

  it('reports midnight as minute 0, never 1440', () => {
    const at = wallClockNow(new Date('2026-08-13T03:00:00Z'));
    expect(at.minutes).toBe(0);
    expect(at.day).toBe(4);
  });
});

describe('previousDay', () => {
  it('wraps Sunday back to Saturday', () => {
    expect(previousDay(0)).toBe(6);
    expect(previousDay(3)).toBe(2);
  });
});

describe('isRangeOpenAt', () => {
  const lunch = { day: 3, openMinute: 660, closeMinute: 900 }; // Wed 11:00–15:00

  it('is open inside the range and closed outside it', () => {
    expect(isRangeOpenAt(lunch, { day: 3, minutes: 700 })).toBe(true);
    expect(isRangeOpenAt(lunch, { day: 3, minutes: 659 })).toBe(false);
    expect(isRangeOpenAt(lunch, { day: 3, minutes: 901 })).toBe(false);
  });

  it('treats the opening minute as open and the closing minute as closed', () => {
    expect(isRangeOpenAt(lunch, { day: 3, minutes: 660 })).toBe(true);
    expect(isRangeOpenAt(lunch, { day: 3, minutes: 900 })).toBe(false);
  });

  it('ignores a range belonging to another day', () => {
    expect(isRangeOpenAt(lunch, { day: 4, minutes: 700 })).toBe(false);
  });

  it('handles a range that crosses midnight, on both sides of it', () => {
    const night = { day: 5, openMinute: 1140, closeMinute: 120 }; // Fri 19:00–02:00
    expect(isRangeOpenAt(night, { day: 5, minutes: 1400 })).toBe(true); // Fri 23:20
    expect(isRangeOpenAt(night, { day: 6, minutes: 60 })).toBe(true); // Sat 01:00
    expect(isRangeOpenAt(night, { day: 6, minutes: 121 })).toBe(false); // Sat 02:01
    expect(isRangeOpenAt(night, { day: 5, minutes: 1000 })).toBe(false); // Fri 16:40
  });

  it('closes at midnight when the range ends at 00:00', () => {
    const late = { day: 5, openMinute: 1140, closeMinute: 0 }; // Fri 19:00–00:00
    expect(isRangeOpenAt(late, { day: 5, minutes: 1439 })).toBe(true);
    expect(isRangeOpenAt(late, { day: 6, minutes: 0 })).toBe(false);
  });

  it('wraps a Saturday-night range into Sunday', () => {
    const satNight = { day: 6, openMinute: 1320, closeMinute: 180 }; // Sat 22:00–03:00
    expect(isRangeOpenAt(satNight, { day: 0, minutes: 120 })).toBe(true);
  });
});

describe('isOpenAt', () => {
  it('is open when any one range matches', () => {
    const ranges = [
      { day: 3, openMinute: 660, closeMinute: 900 },
      { day: 3, openMinute: 1140, closeMinute: 1380 },
    ];
    expect(isOpenAt(ranges, { day: 3, minutes: 1200 })).toBe(true);
    expect(isOpenAt(ranges, { day: 3, minutes: 1000 })).toBe(false);
    expect(isOpenAt([], { day: 3, minutes: 1200 })).toBe(false);
  });
});

describe('agreement with the rendering path (lib/hours)', () => {
  // The DB filter and the "Abierto ahora" badge must never disagree: a listing
  // returned by ?abierto=1 that renders as "Cerrado" is the bug this guards.
  const hours: DayHours[] = [
    { day: 3, ranges: [{ open: '11:00', close: '15:00' }, { open: '19:00', close: '23:00' }] },
    { day: 5, ranges: [{ open: '19:00', close: '02:00' }] },
  ];
  const rows = dayHoursToRows('r1', hours).map(({ day, openMinute, closeMinute }) => ({
    day,
    openMinute,
    closeMinute,
  }));

  // Asunción is UTC-3 year-round.
  const instants = [
    '2026-08-12T15:30:00Z', // Wed 12:30 — open (lunch shift)
    '2026-08-12T20:00:00Z', // Wed 17:00 — closed between shifts
    '2026-08-12T23:30:00Z', // Wed 20:30 — open (dinner shift)
    '2026-08-15T01:00:00Z', // Fri 22:00 — open (overnight range)
    '2026-08-15T03:30:00Z', // Sat 00:30 — still open from Friday
    '2026-08-15T05:30:00Z', // Sat 02:30 — closed, the overnight range ended
    '2026-08-16T18:00:00Z', // Sun 15:00 — closed, no Sunday hours
  ];

  for (const iso of instants) {
    it(`agrees with computeOpenState at ${iso}`, () => {
      const now = new Date(iso);
      const rendered = computeOpenState(hours, now);
      const expected = 'open' in rendered ? rendered.open : false;
      expect(isOpenAt(rows, wallClockNow(now))).toBe(expected);
    });
  }
});

describe('minute conversion', () => {
  it('round-trips every minute of the day', () => {
    for (let m = 0; m < 1440; m++) {
      expect(toMinutes(toHHMM(m))).toBe(m);
    }
  });

  it('zero-pads', () => {
    expect(toHHMM(0)).toBe('00:00');
    expect(toHHMM(9 * 60 + 5)).toBe('09:05');
    expect(toMinutes('07:00')).toBe(420);
  });
});
