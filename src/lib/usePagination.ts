import { useMemo, useState } from 'react';
import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  pageBounds,
  pageCount,
  pageSlice,
} from './pagination';

/**
 * Client-side pagination for a list that is already in memory.
 *
 * Used by every list this app fetches whole: the users, the roles, the activity log. A list
 * too large to fetch whole should page on the server and hold its own `page` state, because
 * slicing only what was downloaded would quietly answer a different question.
 */

export interface UsePaginationOptions {
  /** Rows per page before the reader changes it. */
  pageSize?: number;
  /**
   * A **primitive** that changes whenever the underlying query does — a joined search and
   * filter string, typically. Page returns to 1 when it changes, because page 4 of the
   * previous result set is not page 4 of this one.
   *
   * Must not be an object or array built inline: a fresh identity every render would reset
   * the page on every render, and the control would refuse to move.
   */
  resetKey?: string | number | boolean | null | undefined;
}

export interface Pagination<T> {
  /** The current page, 1-based and always inside `1..pageCount`. */
  page: number;
  pageSize: number;
  pageCount: number;
  /** The unpaged length of the list. */
  total: number;
  /** The rows this page shows. */
  items: T[];
  /** 1-based inclusive bounds of `items` within the whole list; `0` when the list is empty. */
  from: number;
  to: number;
  setPage: (page: number) => void;
  /** Changing the size returns to page 1 — the old page number means nothing at a new size. */
  setPageSize: (size: number) => void;
}

export function usePagination<T>(
  items: readonly T[],
  { pageSize: initialPageSize = DEFAULT_PAGE_SIZE, resetKey }: UsePaginationOptions = {},
): Pagination<T> {
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setStoredPageSize] = useState(initialPageSize);

  // React's documented "adjust state when a prop changes" pattern rather than an effect:
  // it re-renders before committing, so the reader never sees one frame of page 4 against
  // a freshly-filtered list. `Object.is` so an `undefined` reset key stays stable.
  const [trackedKey, setTrackedKey] = useState(resetKey);
  // The reset takes effect in *this* render rather than through a queued `setRequestedPage`.
  // Both adjustments write to the same state, and the clamp below runs second — so
  // queueing the reset instead would let the clamp of the stale page number overwrite it,
  // which is how "filter down to 12 rows while on page 4" landed on page 2 rather than 1.
  let requested = requestedPage;
  if (!Object.is(trackedKey, resetKey)) {
    setTrackedKey(resetKey);
    requested = 1;
  }

  const total = items.length;
  const count = pageCount(total, pageSize);
  const page = clampPage(requested, total, pageSize);

  // Write the clamp back, so deleting the last row of the last page leaves the control on
  // a page that exists rather than on a number it will keep re-clamping for ever.
  if (page !== requestedPage) setRequestedPage(page);

  const pageItems = useMemo(() => pageSlice(items, page, pageSize), [items, page, pageSize]);
  const { from, to } = pageBounds(page, pageSize, total);

  return {
    page,
    pageSize,
    pageCount: count,
    total,
    items: pageItems,
    from,
    to,
    setPage: (next: number) => setRequestedPage(clampPage(next, total, pageSize)),
    setPageSize: (size: number) => {
      setStoredPageSize(size);
      setRequestedPage(1);
    },
  };
}
