/*
 * Per-report presentation (docs/design/08-reports.md §8.1): every report renders through
 * one page from one result shape, and this is the little that differs between them — where
 * the chart sits, whether sections come before the main table, and what the empty state
 * says. Everything else (columns, chart kind, KPIs) comes from the API's answer itself.
 */

export interface ReportRenderer {
  /** `side`: the chart beside the KPIs (the donut); `full`: across the page. */
  chartLayout: 'full' | 'side';
  /** The weekly report reads as a page: its sections lead, its table follows. */
  sectionsFirst?: boolean;
  /** Heading over the main table. */
  tableTitle: string;
  empty: string;
}

const DEFAULT: ReportRenderer = {
  chartLayout: 'full',
  tableTitle: 'Details',
  empty: 'Nothing matches these filters.',
};

export const RENDERERS: Record<string, Partial<ReportRenderer>> = {
  timesheet: { tableTitle: 'Time per person per day', empty: 'No time logged in this range.' },
  time_by_group: { tableTitle: 'Groups', empty: 'No time logged in this range.' },
  time_entries: { tableTitle: 'Entries', empty: 'No time entries in this range.' },
  estimate_vs_actual: { tableTitle: 'Issues', empty: 'No estimated or worked issues here.' },
  weekly: { sectionsFirst: false, tableTitle: 'Hours per person and project', empty: 'No time logged this week.' },
  project_overview: { chartLayout: 'side', tableTitle: 'By status', empty: 'No issues in this scope.' },
  created_vs_resolved: { tableTitle: 'Per period' },
  workload: { tableTitle: 'Per assignee', empty: 'No open issues in this scope.' },
  epic_progress: { tableTitle: 'Epics', empty: 'No epics in this scope.' },
  sprint_report: { tableTitle: 'Issues in the sprint', empty: 'This sprint has no issues.' },
  burndown: { tableTitle: 'Per day' },
  burnup: { tableTitle: 'Per day' },
  velocity: { tableTitle: 'Sprints', empty: 'No closed sprints yet. Velocity needs at least one.' },
  cfd: { tableTitle: 'Per day' },
  cycle_time: { tableTitle: 'Resolved issues', empty: 'No issues were resolved in this range.' },
};

export function rendererFor(type: string): ReportRenderer {
  return { ...DEFAULT, ...RENDERERS[type] };
}
