import { describe, expect, it } from 'vitest';
import { bandScale, donutColor, labelIndexes, linearScale, linePath, niceStep, seriesColor, shortDate, stack, stackedMax, timeScale, toTime } from './scale';

/** The arithmetic under the charts: axes land on round numbers, stacks add up, lines break on gaps. */

describe('linear scales', () => {
  it('picks round steps', () => {
    expect(niceStep(100, 5)).toBe(20);
    expect(niceStep(7, 5)).toBe(2);
    expect(niceStep(0.3, 5)).toBeCloseTo(0.1);
    expect(niceStep(0)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
  });

  it('widens the domain to whole ticks from zero', () => {
    const scale = linearScale(0, 93, 200, 0);
    expect(scale.domain).toEqual([0, 100]);
    expect(scale.ticks).toEqual([0, 20, 40, 60, 80, 100]);
    expect(scale(0)).toBe(200);
    expect(scale(100)).toBe(0);
    expect(scale(50)).toBe(100);
  });

  it('never divides by zero on an all-zero chart, and labels decimals cleanly', () => {
    const flat = linearScale(0, 0, 0, 100);
    expect(flat.domain).toEqual([0, 1]);
    expect(flat.ticks.every((tick) => String(tick).length <= 3)).toBe(true);
    expect(Number.isFinite(flat(0.5))).toBe(true);
  });
});

describe('band and time scales', () => {
  it('splits the range into padded bands', () => {
    const scale = bandScale(4, 0, 400, 0.5);
    expect(scale.step).toBe(100);
    expect(scale.bandwidth).toBe(50);
    expect(scale(0)).toBe(25);
    expect(scale(3)).toBe(325);
    expect(bandScale(0, 0, 100).step).toBe(0);
  });

  it('reads dates as UTC midnight', () => {
    expect(toTime('2026-10-05')).toBe(Date.UTC(2026, 9, 5));
    expect(toTime('2026-10-05T12:00:00')).toBe(Date.UTC(2026, 9, 5, 12));
    const scale = timeScale(toTime('2026-10-01'), toTime('2026-10-11'), 0, 100);
    expect(scale(toTime('2026-10-06'))).toBeCloseTo(50);
  });

  it('thins labels and shortens dates', () => {
    expect(labelIndexes(3, 5)).toEqual([0, 1, 2]);
    expect(labelIndexes(10, 4)).toEqual([0, 3, 6, 9]);
    expect(shortDate('2026-10-05')).toMatch(/5/);
    expect(shortDate('Alice')).toBe('Alice');
  });
});

describe('stacks, lines and colours', () => {
  it('stacks series, nulls as zero', () => {
    expect(stack([[1, 2], [3, null]])).toEqual([
      [[0, 1], [0, 2]],
      [[1, 4], [2, 2]],
    ]);
    expect(stackedMax([[1, 2], [3, null]])).toBe(4);
    expect(stackedMax([])).toBe(0);
  });

  it('draws lines, stepped lines, and breaks on gaps', () => {
    expect(linePath([[0, 10], [5, 20]])).toBe('M0,10L5,20');
    expect(linePath([[0, 10], [5, 20]], true)).toBe('M0,10H5V20');
    expect(linePath([[0, 10], null, [5, 20], [6, 1]])).toBe('M0,10M5,20L6,1');
  });

  it('colours from the theme', () => {
    expect(seriesColor(0)).toBe('var(--chart-1)');
    expect(seriesColor(8)).toBe('var(--chart-1)');
    expect(seriesColor(0, 'danger')).toBe('var(--danger)');
    expect(seriesColor(0, 'muted')).toBe('var(--muted-foreground)');
    expect(donutColor(2, 3)).toBe('var(--success)');
    expect(donutColor(2, 4)).toBe('var(--chart-3)');
  });
});
