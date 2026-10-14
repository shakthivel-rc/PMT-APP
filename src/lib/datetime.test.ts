import { describe, it, expect } from 'vitest';
import { formatServerDateTime, parseServerDate } from '@/lib/datetime';

describe('parseServerDate', () => {
  it('reads an offset-less server timestamp as UTC, not local', () => {
    // The bug: `Column(DateTime)` is naive and `.isoformat()` emits no Z, and ECMA-262
    // parses an offset-less date-TIME as local. On a UTC+5:30 machine that displayed every
    // audit event five and a half hours late, and the wrong day near midnight.
    expect(parseServerDate('2026-08-07T10:15:00').getTime()).toBe(Date.UTC(2026, 7, 7, 10, 15, 0));
  });

  it('handles fractional seconds, which isoformat() emits when present', () => {
    expect(parseServerDate('2026-08-07T10:15:00.123456').getTime()).toBe(
      Date.UTC(2026, 7, 7, 10, 15, 0, 123),
    );
  });

  it('leaves a value that already carries Z alone', () => {
    const iso = '2026-08-07T10:15:00Z';
    expect(parseServerDate(iso).getTime()).toBe(new Date(iso).getTime());
  });

  it('leaves an explicit offset alone, so it stays correct if the backend is fixed', () => {
    for (const iso of ['2026-08-07T10:15:00+05:30', '2026-08-07T10:15:00-08:00', '2026-08-07T10:15:00+0530']) {
      expect(parseServerDate(iso).getTime()).toBe(new Date(iso).getTime());
    }
  });

  it('returns an Invalid Date for junk rather than a plausible wrong one', () => {
    expect(Number.isNaN(parseServerDate('not a date').getTime())).toBe(true);
  });
});

describe('formatServerDateTime', () => {
  it('formats the same instant the parser produced', () => {
    const value = '2026-08-07T10:15:00';
    const parsed = parseServerDate(value);
    expect(formatServerDateTime(value)).toBe(parsed.toLocaleString());
  });
});
