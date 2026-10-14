import { useMemo } from 'react';
import { FolderKanban } from 'lucide-react';
import type { BoardColumn, IssueCard, StatusSummary } from '@/types';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import { formatDuration } from '@/lib/duration';
import { usePagination } from '@/lib/usePagination';
import { humanize, PriorityBadge, PullRequestBadge } from '../presentation';

interface Row {
  card: IssueCard;
  status: StatusSummary;
}

interface IssueTableProps {
  /** The board's columns — the same data the board draws, flattened here, never refetched. */
  columns: BoardColumn[];
  onOpen: (issueId: string) => void;
}

/** The list view: the board's cards as rows, in board order (by status, then by rank). */
const IssueTable = ({ columns, onOpen }: IssueTableProps) => {
  const rows = useMemo(
    () => columns.flatMap(({ status, cards }) => cards.map((card) => ({ card, status }))),
    [columns],
  );
  const paged = usePagination(rows);

  const tableColumns: DataTableColumn<Row>[] = [
    {
      key: 'key',
      header: 'Key',
      headerClassName: 'pl-4',
      cellClassName: 'pl-4 font-mono text-xs text-muted-foreground',
      cell: ({ card }) => card.key,
    },
    {
      key: 'title',
      header: 'Title',
      // The button is the real control; the row click is only the mouse convenience, and
      // without this one press would open the drawer twice.
      stopRowClick: true,
      cell: ({ card }) => (
        <button
          type="button"
          onClick={() => onOpen(card.id)}
          className="rounded-sm text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {card.title}
        </button>
      ),
    },
    { key: 'status', header: 'Status', cell: ({ status }) => status.name },
    { key: 'type', header: 'Type', cell: ({ card }) => humanize(card.type) },
    { key: 'priority', header: 'Priority', cell: ({ card }) => <PriorityBadge priority={card.priority} /> },
    { key: 'points', header: 'Points', align: 'right', cell: ({ card }) => card.story_points ?? '—' },
    {
      key: 'estimate',
      header: 'Estimate',
      align: 'right',
      cell: ({ card }) => (card.time_estimate_seconds === null ? '—' : formatDuration(card.time_estimate_seconds)),
    },
    {
      key: 'logged',
      header: 'Logged',
      align: 'right',
      cell: ({ card }) => {
        const over = card.time_estimate_seconds !== null && card.time_spent_seconds > card.time_estimate_seconds;
        return (
          <span className={over ? 'font-medium text-danger' : undefined}>
            {card.time_spent_seconds ? formatDuration(card.time_spent_seconds) : '—'}
            {over && <span className="sr-only"> (over the estimate)</span>}
          </span>
        );
      },
    },
    { key: 'assignee', header: 'Assignee', cell: ({ card }) => card.assignee?.display_name ?? 'Unassigned' },
    { key: 'pr', header: 'PR', cell: ({ card }) => <PullRequestBadge state={card.pull_request_state} /> },
  ];

  return (
    <div className="min-h-0 overflow-auto rounded-xl border bg-card">
      <DataTable
        columns={tableColumns}
        rows={paged.items}
        rowKey={({ card }) => card.id}
        caption="Issues in this list, in board order."
        ariaLabel="Issues"
        onRowClick={({ card }) => onOpen(card.id)}
        animate={false}
        empty={
          <EmptyState
            icon={FolderKanban}
            title="No issues in this list"
            description="Switch to the board to add the first one."
          />
        }
        pagination={{
          page: paged.page,
          pageSize: paged.pageSize,
          total: paged.total,
          onPageChange: paged.setPage,
          onPageSizeChange: paged.setPageSize,
          label: 'Issue pages',
          itemNoun: { one: 'issue', other: 'issues' },
        }}
      />
    </div>
  );
};

export default IssueTable;
