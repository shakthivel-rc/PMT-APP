import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Pagination from '@/components/Pagination';
import { cn } from '@/lib/utils';

/**
 * The one table in this app.
 *
 * Every screen that shows rows declares **columns and a row renderer** and passes them
 * here; none of them write `<table>`, `<tr>` or `<td>` themselves. Hand-written copies of
 * the same markup drift apart — one wraps the shadcn `<Table>` (which brings its own scroll
 * container) in a second `overflow-x-auto`, one grows a sticky header the others lack, and
 * the accessible caption becomes optional in practice. A column list cannot drift in those
 * ways.
 *
 * What stays in the caller: what a cell *says*. `cell` returns a node, so a status badge, a
 * link, a switch or a dash for an absent value is still the feature's decision — this
 * component only decides where it goes and what surrounds it.
 */

export interface DataTableColumn<T> {
  /** Stable identity for the column. Also the React key for its cells. */
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Right-aligned, for the columns a reader scans down rather than reads across. */
  align?: 'left' | 'right' | 'center';
  headerClassName?: string;
  cellClassName?: string;
  /**
   * Swallow clicks inside this cell before the row's `onRowClick` sees them.
   *
   * For a cell that is itself a control. Radix's switch fires on pointer-down and the row
   * handler on click, so without this a press both flips the switch and navigates away
   * from the result it produced.
   */
  stopRowClick?: boolean;
  /**
   * Turns the header into a sort button and reports the state to assistive technology.
   * A column without this renders a plain header, which is what a control column wants.
   */
  sort?: {
    active: boolean;
    direction: 'asc' | 'desc';
    onToggle: () => void;
    /** Rendered inside the button beside the label — the caller owns the arrow. */
    indicator?: ReactNode;
  };
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  /** Names the `<nav>` landmark; must be unique among the paginators on one screen. */
  label?: string;
  itemNoun?: { one: string; other: string };
  disabled?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  /** The rows for the current page. Already sliced by the caller. */
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Screen-reader caption. Required: a table with no caption is one nobody can identify. */
  caption: ReactNode;
  ariaLabel?: string;
  rowClassName?: (row: T, index: number) => string | undefined;
  /** A mouse convenience only. Always give the row a real link or button as well. */
  onRowClick?: (row: T) => void;
  /** Marks one row busy while a write against it is in flight. */
  rowBusy?: (row: T) => boolean;
  /**
   * Rendered instead of the table when `rows` is empty — an `<EmptyState>`, normally. The
   * caller owns the copy because "nothing here" and "nothing matches your filter" are
   * different facts and only the caller knows which one is true.
   */
  empty?: ReactNode;
  /** Rendered above the empty state too, so a skeleton can replace the whole body. */
  loading?: ReactNode;
  /** Row entry animation. On by default, matching what every table did before. */
  animate?: boolean;
  /** Paginated footer. Omit for a list that is genuinely bounded. */
  pagination?: DataTablePagination;
  /**
   * A totals row, as a real `<tfoot>`, keyed by column `key`; a column with no entry gets an
   * empty cell. Added 2026-10-05 for the timesheet's per-day totals: content in `footer`
   * renders outside the table, where a screen reader cannot read it as the row that sums the
   * columns above it.
   */
  totals?: Partial<Record<string, ReactNode>>;
  /** Extra footer content, under the rows and above the pagination bar. */
  footer?: ReactNode;
  className?: string;
}

const ALIGNMENT = {
  left: '',
  right: 'text-right',
  center: 'text-center',
} as const;

/** The same row treatment `TableRow` applies, spelled out for the `motion.tr` variant. */
const ROW_CLASS = 'border-b transition-colors hover:bg-muted/50';

function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  ariaLabel,
  rowClassName,
  onRowClick,
  rowBusy,
  empty,
  loading,
  animate = true,
  pagination,
  totals,
  footer,
  className,
}: DataTableProps<T>) {
  if (loading) return <>{loading}</>;
  if (rows.length === 0) return <>{empty ?? null}</>;

  return (
    <>
      <Table aria-label={ariaLabel} className={cn('min-w-[600px]', className)}>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const align = ALIGNMENT[column.align ?? 'left'];
              return (
                <TableHead
                  key={column.key}
                  className={cn(align, column.headerClassName)}
                  aria-sort={
                    column.sort
                      ? column.sort.active
                        ? column.sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                >
                  {column.sort ? (
                    <button
                      type="button"
                      onClick={column.sort.onToggle}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        // Reversed, so the arrow sits beside the numbers it orders rather
                        // than off at the far edge of a right-aligned column.
                        column.align === 'right' && 'flex-row-reverse',
                        column.sort.active && 'text-foreground',
                      )}
                    >
                      {column.header}
                      {column.sort.indicator}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const busy = rowBusy?.(row) ?? false;
            const cells = columns.map((column) => (
              <TableCell
                key={column.key}
                className={cn('py-3', ALIGNMENT[column.align ?? 'left'], column.cellClassName)}
                onClick={
                  column.stopRowClick ? (event) => event.stopPropagation() : undefined
                }
              >
                {column.cell(row, index)}
              </TableCell>
            ));
            const rowClasses = cn(
              ROW_CLASS,
              onRowClick && 'cursor-pointer',
              busy && 'pointer-events-none opacity-60',
              rowClassName?.(row, index),
            );
            const handlers = {
              className: rowClasses,
              'aria-busy': busy || undefined,
              onClick: onRowClick ? () => onRowClick(row) : undefined,
            };

            return animate ? (
              <motion.tr
                key={rowKey(row, index)}
                data-slot="table-row"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                // Capped, so a hundred-row page does not stagger for two seconds before the
                // last row appears.
                transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.2) }}
                {...handlers}
              >
                {cells}
              </motion.tr>
            ) : (
              <TableRow key={rowKey(row, index)} {...handlers}>
                {cells}
              </TableRow>
            );
          })}
        </TableBody>
        {totals && (
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn('py-3', ALIGNMENT[column.align ?? 'left'], column.cellClassName)}
                >
                  {totals[column.key] ?? null}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>

      {footer}

      {pagination && <Pagination {...pagination} />}
    </>
  );
}

export default DataTable;
