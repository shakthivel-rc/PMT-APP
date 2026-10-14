import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  clampPage,
  pageBounds,
  pageCount,
  pageNumbers,
  pageSizeOptions,
  pageSlice,
} from './pagination';

/**
 * The two things a paginator gets wrong are both arithmetic: the page that no longer
 * exists after the list shrank, and the "showing 41–50 of 47" that quietly lies about the
 * last page. Everything below is one of those two, or a guard against the arithmetic being
 * handed something that is not a number at all.
 */

describe('pageCount', () => {
  it('counts whole pages and one more for the remainder', () => {
    expect(pageCount(100, 10)).toBe(10);
    expect(pageCount(101, 10)).toBe(11);
    expect(pageCount(9, 10)).toBe(1);
  });

  it('is never zero, so an empty list is page 1 of 1', () => {
    // "Page 1 of 0" is a sentence about a broken component, not about an empty table.
    expect(pageCount(0, 10)).toBe(1);
  });

  it('falls back to the default size rather than dividing by zero', () => {
    expect(pageCount(25, 0)).toBe(pageCount(25, DEFAULT_PAGE_SIZE));
    expect(pageCount(25, -5)).toBe(pageCount(25, DEFAULT_PAGE_SIZE));
    expect(pageCount(25, Number.NaN)).toBe(pageCount(25, DEFAULT_PAGE_SIZE));
  });

  it('treats a nonsense total as no items rather than as infinity', () => {
    expect(pageCount(Number.NaN, 10)).toBe(1);
    expect(pageCount(-4, 10)).toBe(1);
  });
});

describe('clampPage', () => {
  it('pulls a page beyond the end back to the last real page', () => {
    // The case that matters: the reader is on page 5 and deletes the row that made it exist.
    expect(clampPage(5, 12, 10)).toBe(2);
  });

  it('pulls a page below one back to one', () => {
    expect(clampPage(0, 100, 10)).toBe(1);
    expect(clampPage(-3, 100, 10)).toBe(1);
  });

  it('leaves a page that is already in range alone', () => {
    expect(clampPage(4, 100, 10)).toBe(4);
  });

  it('lands on page 1 for a page that is not a number', () => {
    expect(clampPage(Number.NaN, 100, 10)).toBe(1);
  });
});

describe('pageSlice', () => {
  const items = Array.from({ length: 23 }, (_, index) => index + 1);

  it('returns the window the page names', () => {
    expect(pageSlice(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(pageSlice(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('returns the short remainder on the last page', () => {
    expect(pageSlice(items, 3, 10)).toEqual([21, 22, 23]);
  });

  it('clamps an out-of-range page rather than returning nothing', () => {
    // An empty table for a page number that is merely stale is indistinguishable from an
    // empty list, which is the more alarming of the two.
    expect(pageSlice(items, 99, 10)).toEqual([21, 22, 23]);
  });

  it('returns an empty list for an empty list', () => {
    expect(pageSlice([], 1, 10)).toEqual([]);
  });
});

describe('pageBounds', () => {
  it('gives the 1-based inclusive window of the page', () => {
    expect(pageBounds(1, 10, 137)).toEqual({ from: 1, to: 10 });
    expect(pageBounds(5, 10, 137)).toEqual({ from: 41, to: 50 });
  });

  it('stops the upper bound at the total on the last page', () => {
    // "Showing 131–140 of 137" is the lie this exists to prevent.
    expect(pageBounds(14, 10, 137)).toEqual({ from: 131, to: 137 });
  });

  it('is zero to zero when there is nothing to show', () => {
    expect(pageBounds(1, 10, 0)).toEqual({ from: 0, to: 0 });
  });

  it('treats a nonsense total as nothing to show rather than as infinity', () => {
    expect(pageBounds(1, 10, Number.NaN)).toEqual({ from: 0, to: 0 });
  });

  it('falls back to the default size rather than dividing by zero', () => {
    expect(pageBounds(2, 0, 137)).toEqual(pageBounds(2, DEFAULT_PAGE_SIZE, 137));
  });

  it('reports the last page for a stale page number, matching what pageSlice renders', () => {
    expect(pageBounds(99, 10, 23)).toEqual({ from: 21, to: 23 });
  });
});

describe('pageNumbers', () => {
  it('lists every page while they all fit', () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the first and last page reachable once it has to elide', () => {
    const tokens = pageNumbers(8, 20);
    expect(tokens[0]).toBe(1);
    expect(tokens[tokens.length - 1]).toBe(20);
    expect(tokens).toContain('gap');
  });

  it('slides the window around the current page', () => {
    expect(pageNumbers(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
    expect(pageNumbers(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
    expect(pageNumbers(20, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
  });

  it('renders a constant number of tokens, so the control does not resize as you page', () => {
    for (let page = 1; page <= 20; page += 1) {
      expect(pageNumbers(page, 20)).toHaveLength(7);
    }
  });

  it('always includes the current page', () => {
    for (let page = 1; page <= 40; page += 1) {
      expect(pageNumbers(page, 40)).toContain(page);
    }
  });

  it('honours a wider or narrower button budget', () => {
    expect(pageNumbers(10, 20, 9)).toHaveLength(9);
    // Below five there is no room for `1 … n … last`, so it clamps up rather than
    // rendering a control that cannot navigate.
    expect(pageNumbers(10, 20, 3)).toHaveLength(5);
  });

  it('has nothing to render for a list with no pages', () => {
    expect(pageNumbers(1, 0)).toEqual([]);
    expect(pageNumbers(1, Number.NaN)).toEqual([]);
  });

  it('falls back to a sensible budget when handed a nonsense one', () => {
    expect(pageNumbers(10, 20, Number.NaN)).toEqual(pageNumbers(10, 20));
  });

  it('clamps a current page outside the range instead of dropping the window', () => {
    expect(pageNumbers(99, 20)).toEqual(pageNumbers(20, 20));
  });
});

describe('pageSizeOptions', () => {
  it('offers the shared sizes when the current one is already among them', () => {
    expect(pageSizeOptions(25)).toEqual([...PAGE_SIZE_OPTIONS]);
  });

  it('folds an unlisted current size in, sorted', () => {
    // A `<Select>` whose value matches no item renders as an empty trigger, which looks
    // like a bug and cannot be read back.
    expect(pageSizeOptions(15)).toEqual([10, 15, 25, 50, 100]);
  });

  it('does not duplicate the current size', () => {
    expect(pageSizeOptions(10, [10, 20])).toEqual([10, 20]);
  });
});
