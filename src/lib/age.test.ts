import { describe, expect, it } from 'vitest';
import { daysInStage, formatAge, secondsInStage } from './age';

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0) / 1000;

describe('work-item age', () => {
  it('measures from the stage entry time, offset-less server times read as UTC', () => {
    expect(secondsInStage('2026-10-06T10:00:00', NOW)).toBe(7200);
    expect(secondsInStage('2026-10-06T10:00:00Z', NOW)).toBe(7200);
  });

  it('has no age without an entry time, and never a negative one', () => {
    expect(secondsInStage(null, NOW)).toBeNull();
    expect(secondsInStage('not a date', NOW)).toBeNull();
    expect(secondsInStage('2026-10-07T10:00:00Z', NOW)).toBe(0);
  });

  it('formats short enough for a card', () => {
    expect(formatAge(59 * 60)).toBe('<1h');
    expect(formatAge(5 * 3600 + 10)).toBe('5h');
    expect(formatAge(3 * 86_400 + 7200)).toBe('3d');
    expect(daysInStage(3 * 86_400 + 7200)).toBe(3);
  });
});
