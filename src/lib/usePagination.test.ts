import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePagination } from './usePagination';

/**
 * The hook that owns a client-side list's page.
 *
 * Two behaviours here are the ones that go wrong in hand-rolled paginators and are the
 * reason this is shared: the page has to come back to 1 when the *query* changes, and it
 * has to survive the list shrinking under it — deleting the last row of the last page must
 * not leave the reader staring at an empty table.
 */

const range = (length: number) => Array.from({ length }, (_, index) => index + 1);

describe('usePagination', () => {
  it('slices the list into pages and reports where it is', () => {
    const { result } = renderHook(() => usePagination(range(23), { pageSize: 10 }));

    expect(result.current.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.current.page).toBe(1);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.total).toBe(23);
    expect(result.current.from).toBe(1);
    expect(result.current.to).toBe(10);
  });

  it('moves to the page it is asked for', () => {
    const { result } = renderHook(() => usePagination(range(23), { pageSize: 10 }));

    act(() => result.current.setPage(3));

    expect(result.current.items).toEqual([21, 22, 23]);
    expect(result.current.from).toBe(21);
    expect(result.current.to).toBe(23);
  });

  it('refuses a page that does not exist rather than showing nothing', () => {
    const { result } = renderHook(() => usePagination(range(23), { pageSize: 10 }));

    act(() => result.current.setPage(99));

    expect(result.current.page).toBe(3);
    expect(result.current.items).toEqual([21, 22, 23]);
  });

  it('returns to page 1 when the reset key changes', () => {
    // The reset key stands for the query. Page 3 of the previous search is not page 3 of
    // this one, and leaving the number alone silently shows the wrong window.
    const { result, rerender } = renderHook(
      ({ items, key }: { items: number[]; key: string }) =>
        usePagination(items, { pageSize: 10, resetKey: key }),
      { initialProps: { items: range(50), key: 'all' } },
    );

    act(() => result.current.setPage(4));
    expect(result.current.page).toBe(4);

    rerender({ items: range(12), key: 'filtered' });

    expect(result.current.page).toBe(1);
    expect(result.current.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('stays put while the reset key does not change', () => {
    // A list that is re-fetched after every save must not snap the reader back to page 1.
    const { result, rerender } = renderHook(
      ({ items }: { items: number[] }) => usePagination(items, { pageSize: 10 }),
      { initialProps: { items: range(50) } },
    );

    act(() => result.current.setPage(4));
    rerender({ items: range(50) });

    expect(result.current.page).toBe(4);
  });

  it('falls back to the last real page when the list shrinks under it', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: number[] }) => usePagination(items, { pageSize: 10 }),
      { initialProps: { items: range(50) } },
    );

    act(() => result.current.setPage(5));
    expect(result.current.page).toBe(5);

    // Somebody deleted the rows that made page 5 exist.
    rerender({ items: range(12) });

    expect(result.current.page).toBe(2);
    expect(result.current.items).toEqual([11, 12]);
  });

  it('returns to page 1 when the size changes, because the old number means nothing', () => {
    const { result } = renderHook(() => usePagination(range(100), { pageSize: 10 }));

    act(() => result.current.setPage(7));
    act(() => result.current.setPageSize(25));

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.items).toHaveLength(25);
  });

  it('reports an empty list as page 1 of 1 with a zero range', () => {
    const { result } = renderHook(() => usePagination<number>([], { pageSize: 10 }));

    expect(result.current.page).toBe(1);
    expect(result.current.pageCount).toBe(1);
    expect(result.current.items).toEqual([]);
    expect(result.current.from).toBe(0);
    expect(result.current.to).toBe(0);
  });

  it('defaults to the shared page size when none is given', () => {
    const { result } = renderHook(() => usePagination(range(50)));
    expect(result.current.pageSize).toBe(10);
  });
});
