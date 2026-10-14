import { describe, it, expect } from 'vitest';
import { addDays, dayLabel, formatDateKey, parseDateKey, startOfWeek, toDateKey, weekDays } from '@/lib/week';

/*
 * Built from local parts throughout, so these hold in any TZ the suite runs in — which is the
 * property under test: nothing here may depend on UTC's idea of what day it is.
 */

describe('toDateKey / parseDateKey', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 00:30 local is still "yesterday" in UTC east of Greenwich; the key must not be.
    expect(toDateKey(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05');
    expect(toDateKey(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
  });

  it('round-trips a real day and refuses one that is not', () => {
    expect(toDateKey(parseDateKey('2026-10-05') as Date)).toBe('2026-10-05');
    expect(parseDateKey('2026-02-31')).toBeNull();
    expect(parseDateKey('05/10/2026')).toBeNull();
  });
});

describe('weeks', () => {
  it('starts a week on Monday or Sunday', () => {
    const sunday = new Date(2026, 9, 4);
    expect(toDateKey(startOfWeek(sunday, 'monday'))).toBe('2026-09-28');
    expect(toDateKey(startOfWeek(sunday, 'sunday'))).toBe('2026-10-04');
    expect(toDateKey(startOfWeek(new Date(2026, 9, 5)))).toBe('2026-10-05');
  });

  it('has seven distinct days, across a month end and any DST change', () => {
    const days = weekDays(new Date(2026, 9, 26)).map(toDateKey);
    expect(days).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
    ]);
    expect(toDateKey(addDays(new Date(2026, 2, 28), 2))).toBe('2026-03-30');
  });
});

describe('labels', () => {
  it('names a day and formats a key without treating it as an instant', () => {
    expect(dayLabel(new Date(2026, 9, 5))).toMatch(/5/);
    expect(formatDateKey('2026-10-05')).toMatch(/2026/);
    expect(formatDateKey('not-a-day')).toBe('not-a-day');
  });
});
