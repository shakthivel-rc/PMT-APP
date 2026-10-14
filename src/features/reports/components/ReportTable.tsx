import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ListTree } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import type { ReportColumn, ReportParams, ReportRow } from '@/types/reports';
import { cn } from '@/lib/utils';
import { formatValue, isNumeric } from '../format';
import { searchFromParams } from '../params';

/*
 * A report's rows, on the app's one table (components/DataTable). What it adds is what
 * reports have and lists do not:
 *
 * * **Grouping.** A row's `_depth` is its level in a two-level grouping (person, then
 *   project); a row followed by deeper rows is a group, and collapses.
 * * **Drill-down.** A group's `_drill` is the `time_entries` parameters behind its number,
 *   so every total opens onto the entries that make it up — the number is never a dead end.
 * * **Totals**, as the table's own `<tfoot>`.
 *
 * Rows arrive in display order from the API, and are paged here, not there: the API caps a
 * report at `MAX_SYNC_ROWS` and points larger ones at an export.
 */

const PAGE_SIZE = 100;

interface ReportTableProps {
  columns: ReportColumn[];
  rows: ReportRow[];
  totals?: ReportRow | null;
  caption: string;
  workspaceId?: string;
  /** Rows per page; the sections of a report are short and pass `Infinity`. */
  pageSize?: number;
}

/** Which rows have children: the next row is deeper. */
export function groupIndexes(rows: ReportRow[]): Set<number> {
  const groups = new Set<number>();
  rows.forEach((row, index) => {
    const next = rows[index + 1];
    if (next && (next._depth ?? 0) > (row._depth ?? 0)) groups.add(index);
  });
  return groups;
}

/** The rows left visible when the groups at `collapsed` (indexes into `rows`) are closed. */
export function visibleRows(rows: ReportRow[], collapsed: Set<number>): { row: ReportRow; index: number }[] {
  const out: { row: ReportRow; index: number }[] = [];
  let hideDeeperThan: number | null = null;
  rows.forEach((row, index) => {
    const depth = row._depth ?? 0;
    if (hideDeeperThan !== null && depth > hideDeeperThan) return;
    hideDeeperThan = collapsed.has(index) ? depth : null;
    out.push({ row, index });
  });
  return out;
}

function drillHref(drill: ReportParams, workspaceId?: string): string {
  const query = searchFromParams(drill);
  if (workspaceId) query.set('workspace', workspaceId);
  return `/reports/time_entries?${query.toString()}`;
}

export function ReportTable({ columns, rows, totals, caption, workspaceId, pageSize = PAGE_SIZE }: ReportTableProps) {
  const groups = useMemo(() => groupIndexes(rows), [rows]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const visible = useMemo(() => visibleRows(rows, collapsed), [rows, collapsed]);
  const paged = Number.isFinite(pageSize) && visible.length > pageSize;
  const pageRows = paged ? visible.slice((page - 1) * pageSize, page * pageSize) : visible;
  const hasGroups = groups.size > 0;

  const toggle = (index: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const tableColumns: DataTableColumn<{ row: ReportRow; index: number }>[] = columns.map((column, position) => ({
    key: column.key,
    header: column.label,
    align: isNumeric(column.type) ? 'right' : 'left',
    cellClassName: isNumeric(column.type) ? 'tabular-nums' : undefined,
    cell: ({ row, index }) => {
      const text = formatValue(row[column.key], column.type);
      if (position !== 0) {
        if (row._drill && isNumeric(column.type) && column.type === 'duration') {
          return (
            <Link
              to={drillHref(row._drill, workspaceId)}
              className="underline-offset-2 hover:underline"
              title="Open the time entries behind this number"
            >
              {text}
            </Link>
          );
        }
        return text;
      }
      const depth = row._depth ?? 0;
      const isGroup = groups.has(index);
      return (
        <span className={cn('flex items-center gap-1', depth > 0 && 'text-muted-foreground')} style={{ paddingLeft: depth * 20 }}>
          {hasGroups &&
            (isGroup ? (
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={!collapsed.has(index)}
                aria-label={`${collapsed.has(index) ? 'Expand' : 'Collapse'} ${text}`}
                className="rounded p-0.5 hover:bg-muted print:hidden"
              >
                {collapsed.has(index) ? (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            ) : (
              <span className="inline-block w-4.5" aria-hidden />
            ))}
          <span className={cn(isGroup && 'font-medium text-foreground')}>{text}</span>
          {row._drill && (
            <Link
              to={drillHref(row._drill, workspaceId)}
              className="ml-1 text-muted-foreground hover:text-foreground print:hidden"
              aria-label={`Time entries for ${text}`}
              title="Time entries"
            >
              <ListTree className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </span>
      );
    },
  }));

  const totalsRow = totals
    ? Object.fromEntries(
        columns.map((column, position) => [
          column.key,
          totals[column.key] === undefined || totals[column.key] === null
            ? position === 0
              ? 'Total'
              : ''
            : formatValue(totals[column.key], column.type),
        ]),
      )
    : undefined;

  return (
    <DataTable
      columns={tableColumns}
      rows={pageRows}
      rowKey={({ row, index }) => String(row._key ?? index)}
      caption={caption}
      animate={false}
      totals={totalsRow}
      rowClassName={({ row }) => ((row._depth ?? 0) === 0 && hasGroups ? 'bg-muted/30' : undefined)}
      empty={<p className="py-8 text-center text-sm text-muted-foreground">No rows for these filters.</p>}
      pagination={
        paged
          ? {
              page,
              pageSize,
              total: visible.length,
              onPageChange: setPage,
              label: `${caption} pages`,
              itemNoun: { one: 'row', other: 'rows' },
            }
          : undefined
      }
    />
  );
}
