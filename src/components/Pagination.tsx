import { useId } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PAGE_SIZE_OPTIONS,
  clampPage,
  pageBounds,
  pageCount as countPages,
  pageNumbers,
  pageSizeOptions as resolvePageSizes,
} from '@/lib/pagination';
import { cn } from '@/lib/utils';

/**
 * The one pagination control in this app.
 *
 * ## Numbered pages, not "Load more"
 *
 * "Load more" can only ever go forward and has no way to say where you are. A reader who
 * wants the oldest entry in a list of four hundred should not have to press a button eight
 * times to reach it, and a reader who has read page 3 should be able to come back to page 3.
 *
 * ## The summary line is a live region
 *
 * Paging swaps the rows underneath without moving focus, which for a screen-reader user is
 * a silent change. `role="status"` on "Showing 41–50 of 137" is what announces it.
 *
 * ## Every instance needs its own `label`
 *
 * It renders a `<nav>` landmark, and two landmarks with the same accessible name on one
 * page is both an axe violation and genuinely ambiguous in a landmark list.
 */

interface PaginationProps {
  /** 1-based. Clamped for display, so an out-of-range value cannot render a dead control. */
  page: number;
  pageSize: number;
  /** The unpaged total. The control derives its page count from this, never from the rows. */
  total: number;
  onPageChange: (page: number) => void;
  /** Omit to hide the rows-per-page picker — the size is then whatever the caller fixed. */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  /** Names the landmark, and the noun in "Showing 1–10 of 137 users". */
  label?: string;
  /** Singular/plural noun for the summary. Defaults to "item"/"items". */
  itemNoun?: { one: string; other: string };
  /** Render nothing when everything fits on one page — for lists inside a card or a dialog. */
  hideWhenSinglePage?: boolean;
  /** Greys the whole control out while a page request is in flight. */
  disabled?: boolean;
  className?: string;
}

const DEFAULT_NOUN = { one: 'item', other: 'items' };

const Pagination = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions: sizeOptions = PAGE_SIZE_OPTIONS,
  label = 'Pagination',
  itemNoun = DEFAULT_NOUN,
  hideWhenSinglePage = false,
  disabled = false,
  className,
}: PaginationProps) => {
  // Unique per instance: several paginated lists share a screen on the RBAC page, and a
  // duplicated `id` would point every "Rows per page" label at the first one's select.
  const sizeId = useId();

  const pageTotal = countPages(total, pageSize);
  const current = clampPage(page, total, pageSize);
  const { from, to } = pageBounds(current, pageSize, total);

  if (total === 0) return null;
  if (hideWhenSinglePage && pageTotal <= 1) return null;

  const noun = total === 1 ? itemNoun.one : itemNoun.other;
  const go = (next: number) => {
    const target = clampPage(next, total, pageSize);
    if (target !== current) onPageChange(target);
  };

  return (
    <nav
      aria-label={label}
      className={cn(
        'flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/*
          Polite rather than assertive: paging is a deliberate action whose result the
          reader is waiting for, and interrupting them mid-word to say so is worse than
          announcing it at the next opportunity.
        */}
        <p className="text-sm text-muted-foreground" role="status">
          Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {noun}
        </p>

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <Label htmlFor={sizeId} className="text-xs whitespace-nowrap text-muted-foreground">
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              disabled={disabled}
            >
              <SelectTrigger id={sizeId} size="sm" className="w-[4.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolvePageSizes(pageSize, sizeOptions).map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => go(1)}
          disabled={disabled || current === 1}
          aria-label="Go to first page"
        >
          <ChevronsLeft aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => go(current - 1)}
          disabled={disabled || current === 1}
          aria-label="Go to previous page"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>

        {/*
          The numbered buttons are hidden on narrow screens rather than wrapped: five more
          tap targets is what pushes this row onto three lines on a phone, and prev/next
          plus the "Page 4 of 14" beside them can already do everything they can.
        */}
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers(current, pageTotal).map((token, index) =>
            token === 'gap' ? (
              <span
                // Position is the only identity an ellipsis has, and there are at most two.
                key={`gap-${index}`}
                className="px-1 text-sm text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                key={token}
                variant={token === current ? 'default' : 'outline'}
                size="icon-sm"
                onClick={() => go(token)}
                disabled={disabled}
                // The programmatic "you are here", so a screen reader hears which button is
                // the current page rather than only seeing it filled in.
                aria-current={token === current ? 'page' : undefined}
                aria-label={`Go to page ${token}`}
                className="tabular-nums"
              >
                {token}
              </Button>
            ),
          )}
        </div>

        <span className="px-2 text-sm whitespace-nowrap text-muted-foreground tabular-nums sm:hidden">
          Page {current} of {pageTotal}
        </span>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => go(current + 1)}
          disabled={disabled || current === pageTotal}
          aria-label="Go to next page"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => go(pageTotal)}
          disabled={disabled || current === pageTotal}
          aria-label="Go to last page"
        >
          <ChevronsRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
};

export default Pagination;
