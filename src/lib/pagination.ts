/**
 * The arithmetic behind every paginated list in this app.
 *
 * Kept as pure functions rather than folded into the hook or the control, because the two
 * things a paginator gets wrong are both arithmetic: the page that no longer exists after
 * the list shrank, and the "showing 41–50 of 47" that quietly lies about the last page.
 * Both are testable here without rendering anything.
 */

/** The default window for a dense table. Small enough that the footer is always in view. */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Sizes offered in the per-list picker.
 *
 * Sorted ascending and de-duplicated at render time: a list whose own default is not one of
 * these (e.g. a table that starts at 20) still has to be able to show its current value.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** A numbered button, or the ellipsis that stands in for a run of skipped pages. */
export type PageToken = number | 'gap';

/**
 * Inclusive integer range.
 *
 * No guard for `end < start`: `Array.from` reads a negative length as zero, so that case
 * already yields an empty array — and a guard nothing can reach is a branch no test can
 * cover.
 */
function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function toPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const floored = Math.floor(value);
  return floored > 0 ? floored : fallback;
}

/**
 * How many pages `total` items fill.
 *
 * **Never zero.** An empty list is on page 1 of 1, not page 1 of 0 — "Page 1 of 0" is a
 * sentence about a broken component rather than about an empty table.
 */
export function pageCount(total: number, pageSize: number): number {
  const size = toPositiveInt(pageSize, DEFAULT_PAGE_SIZE);
  const items = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  return Math.max(1, Math.ceil(items / size));
}

/** Pull `page` back inside `1..pageCount`. Used both on input and after a list shrinks. */
export function clampPage(page: number, total: number, pageSize: number): number {
  const count = pageCount(total, pageSize);
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.floor(page)), count);
}

/** The slice of `items` that page shows, with an out-of-range page clamped rather than empty. */
export function pageSlice<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const size = toPositiveInt(pageSize, DEFAULT_PAGE_SIZE);
  const current = clampPage(page, items.length, size);
  const start = (current - 1) * size;
  return items.slice(start, start + size);
}

/**
 * The 1-based inclusive bounds of the current page, for "Showing 41–50 of 137".
 *
 * `{ from: 0, to: 0 }` when there is nothing to show, so a caller can tell "no items" from
 * "one item" without inspecting `total` separately.
 */
export function pageBounds(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number } {
  const items = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  if (items === 0) return { from: 0, to: 0 };
  const size = toPositiveInt(pageSize, DEFAULT_PAGE_SIZE);
  const current = clampPage(page, items, size);
  const from = (current - 1) * size + 1;
  return { from, to: Math.min(current * size, items) };
}

/**
 * The numbered buttons to render, with `'gap'` where pages are skipped.
 *
 * The first and last page are always present — they are the two a reader jumps to — and the
 * window slides around the current page in between. The token count stays constant at
 * `maxButtons` once the list is long enough to need an ellipsis, so the control does not
 * change width as someone pages through it.
 */
export function pageNumbers(current: number, count: number, maxButtons = 7): PageToken[] {
  const pages = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (pages === 0) return [];

  // Below five there is no room for `1 … n … last`, and the ellipsis form stops meaning
  // anything. Clamping up is more useful than rendering a control that cannot navigate.
  const size = Math.max(5, toPositiveInt(maxButtons, 7));
  if (pages <= size) return range(1, pages);

  const page = clampPage(current, pages, 1);
  // Slots left once the first and last page have taken one each.
  const inner = size - 2;

  // Near the start: 1 2 3 4 5 … N
  if (page <= inner - 1) return [...range(1, inner), 'gap', pages];
  // Near the end: 1 … N-4 N-3 N-2 N-1 N
  if (page >= pages - (inner - 2)) return [1, 'gap', ...range(pages - inner + 1, pages)];

  // Middle: 1 … p-1 p p+1 … N — one gap at each end, so `inner - 2` numbered slots remain.
  const span = inner - 2;
  const half = Math.floor((span - 1) / 2);
  const start = page - half;
  return [1, 'gap', ...range(start, start + span - 1), 'gap', pages];
}

/**
 * The size options to offer, with `current` folded in.
 *
 * A list whose own default is not one of the shared sizes must still be able to show that
 * value as the selected option — a `<Select>` whose value matches no item renders as an
 * empty trigger, which looks like a bug and cannot be read back.
 */
export function pageSizeOptions(current: number, options: readonly number[] = PAGE_SIZE_OPTIONS): number[] {
  const size = toPositiveInt(current, DEFAULT_PAGE_SIZE);
  const merged = new Set<number>([...options, size]);
  return Array.from(merged).sort((a, b) => a - b);
}
