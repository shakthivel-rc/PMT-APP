import { describe, it, expect } from 'vitest';
import { durationInput, formatClock, formatDuration, MAX_ENTRY_SECONDS } from '@/lib/duration';
import { durationProblem, parseDuration } from '@/lib/durationParse';

describe('parseDuration', () => {
  it.each([
    ['1h 30m', 5400],
    ['1h30m', 5400],
    ['90m', 5400],
    ['1.5h', 5400],
    ['1,5h', 5400],
    ['2 hours 15 mins', 8100],
    ['45s', 45],
    ['1d', 8 * 3600],
    ['1w', 5 * 8 * 3600],
    ['1:30', 5400],
    ['1:30:15', 5415],
    ['  2H  ', 7200],
  ])('reads %j as %i seconds', (text, seconds) => {
    expect(parseDuration(text)).toBe(seconds);
  });

  it('reads a bare number as hours, the way a spreadsheet timesheet does', () => {
    expect(parseDuration('1.5')).toBe(5400);
    expect(parseDuration('2')).toBe(7200);
  });

  it("uses the workspace's day and week", () => {
    expect(parseDuration('1d', { hoursPerDay: 7.5 })).toBe(27_000);
    expect(parseDuration('1w', { hoursPerDay: 6, daysPerWeek: 4 })).toBe(24 * 3600);
  });

  it.each(['', '   ', 'abc', '1h abc', '1h 30', '1x', '1:75', 'h'])('refuses %j', (text) => {
    // `1h 30` is refused rather than read as 31 hours: it is half-typed `1h 30m`.
    expect(parseDuration(text)).toBeNull();
  });
});

describe('durationProblem', () => {
  it('says nothing about an empty or valid field', () => {
    expect(durationProblem('')).toBeNull();
    expect(durationProblem('1h 30m')).toBeNull();
  });

  it('waits for a unit that may still be coming, and not for one that cannot', () => {
    expect(durationProblem('1h 3')).toEqual(expect.objectContaining({ incomplete: true }));
    expect(durationProblem('1h abc')).toEqual(expect.objectContaining({ incomplete: false }));
  });

  it('refuses zero and anything over one entry', () => {
    expect(durationProblem('0m')?.message).toMatch(/longer than zero/);
    expect(durationProblem('25h')?.message).toMatch(/at most 24h/);
    expect(durationProblem('2h', {}, 3600)?.message).toMatch(/at most 1h/);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [-5, '0m'],
    [40, '40s'],
    [60, '1m'],
    [89, '1m'],
    [90, '2m'],
    [3600, '1h'],
    [5400, '1h 30m'],
    [MAX_ENTRY_SECONDS + 300, '24h 5m'],
  ])('shows %i seconds as %j', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe('formatClock', () => {
  it.each([
    [0, '0:00:00'],
    [309, '0:05:09'],
    [43_200, '12:00:00'],
    [-1, '0:00:00'],
  ])('shows %i seconds as %j', (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });
});

describe('durationInput', () => {
  it('keeps seconds under a minute so editing a short entry does not zero it', () => {
    expect(durationInput(42)).toBe('42s');
    expect(parseDuration(durationInput(42))).toBe(42);
    expect(durationInput(5400)).toBe('1h 30m');
  });
});
