import type { IssuePriority, IssueType, StatusCategory, WorkspaceRole } from './index';

/*
 * Reports (`routes/reports.py` in pmt-api; docs/design/08-reports.md). Every report answers
 * one shape, `ReportResult`, and every renderer here — chart, table, KPI tiles — reads it,
 * the same way the API's CSV, XLSX and PDF exporters do. That is what keeps the screen and
 * the downloaded file in agreement.
 */

export type ReportCategory = 'time' | 'project' | 'sprint' | 'flow';
export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'custom';
export type GroupBy = 'user' | 'project' | 'list' | 'epic' | 'issue' | 'type' | 'billable' | 'week';
export type BurnUnit = 'points' | 'count' | 'hours';
export type Bucket = 'day' | 'week' | 'month';
export type BillableFilter = 'all' | 'billable' | 'non_billable';
export type RoundingMode = 'up' | 'down' | 'nearest';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type DurationFormat = 'decimal' | 'hhmm' | 'iso' | 'seconds';
export type DateFormat = 'iso' | 'normal' | 'epoch';

/** Every parameter a report takes. Each report reads the subset its catalogue entry names. */
export interface ReportParams {
  /** `workspace`, or `space:{id}`, `folder:{id}`, `list:{id}`, `sprint:{id}`. */
  scope?: string;
  preset?: DatePreset | null;
  /** Inclusive `YYYY-MM-DD`. */
  date_from?: string | null;
  date_to?: string | null;
  user_ids?: string[];
  assignee_ids?: string[];
  reporter_ids?: string[];
  issue_ids?: string[];
  types?: IssueType[];
  priorities?: IssuePriority[];
  status_categories?: StatusCategory[];
  epic_id?: string | null;
  sprint_id?: string | null;
  billable?: BillableFilter;
  group_by?: GroupBy[];
  unit?: BurnUnit;
  bucket?: Bucket;
  cumulative?: boolean;
  rounding_minutes?: 0 | 1 | 5 | 6 | 10 | 15 | 30;
  rounding_mode?: RoundingMode;
  sprint_count?: number;
}

export type ColumnType =
  | 'text'
  | 'number'
  | 'duration'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'user'
  | 'issue'
  | 'boolean';

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType | string;
}

export interface ReportKpi {
  key: string;
  label: string;
  value: number | string | null;
  type: ColumnType | string;
}

/**
 * A row, keyed by column key. Keys starting with `_` are for this side only and are never
 * exported: `_depth` (tree level), `_key` (a stable id), `_drill` (the `time_entries`
 * parameters behind a group), `_user_id`, `_issue_id`.
 */
export type ReportRow = Record<string, unknown> & {
  _depth?: number;
  _key?: string;
  _drill?: ReportParams;
};

export interface ReportSection {
  key: string;
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals: ReportRow | null;
}

export interface ChartSeries {
  key: string;
  label: string;
  values: (number | null)[];
  /** A theme token: `success`, `danger`, `muted`, … */
  color?: string;
  dashed?: boolean;
}

export interface ScatterPoint {
  /** An ISO date-time. */
  x: string;
  y: number;
  label?: string;
}

export type ChartKind =
  | 'bar'
  | 'stacked_bar'
  | 'grouped_bar'
  | 'line'
  | 'stacked_area'
  | 'scatter'
  | 'donut'
  | 'bullet';

export interface ReportChart {
  kind: ChartKind | string;
  /** Category labels or ISO dates, one per value. */
  x?: string[];
  series?: ChartSeries[];
  /** `duration` (seconds), `percent`, `days`, `points`, `count`, `hours`. */
  unit?: string;
  orientation?: 'horizontal' | 'vertical';
  /** Burndown and burnup draw steps. */
  step?: boolean;
  /** ISO dates drawn shaded (weekends, by default). */
  non_working?: string[];
  /** Scatter. */
  points?: ScatterPoint[];
  lines?: { key: string; label: string; points: { x: string; y: number }[] }[];
  references?: { label: string; value: number | null }[];
  /** Velocity's average line. */
  reference?: { label: string; value: number | null };
}

export interface ReportMeta {
  type: string;
  title: string;
  scope: string;
  scope_name: string;
  date_from: string | null;
  date_to: string | null;
  timezone: string;
  week_start: string;
  generated_at: string;
  /** 0: no rounding. */
  rounding_minutes: number;
  rounding_mode: RoundingMode | string;
  /** Time visibility is `own`: the time shown is the caller's only. */
  restricted_to_own: boolean;
  notes: string[];
  row_count: number;
  cached: boolean;
  [extra: string]: unknown;
}

export interface ReportResult {
  meta: ReportMeta;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals: ReportRow | null;
  chart: ReportChart | null;
  kpis: ReportKpi[];
  sections: ReportSection[];
}

export interface ReportType {
  type: string;
  title: string;
  category: ReportCategory | string;
  description: string;
  /** `time` (work dates, 92 days), `range` (366 days), `none` (sprint reports). */
  dates: string;
  /** The `ReportParams` keys this report reads. */
  params: string[];
  chart: string | null;
  needs_sprints: boolean;
  max_days: number | null;
}

export interface ReportsSettings {
  /** IANA zone the reports' days, snapshots and schedules use. */
  timezone: string;
  /** 0 = Monday … 6 = Sunday. */
  working_days: number[];
  guest_access: boolean;
  export_min_role: WorkspaceRole;
  schedule_min_role: WorkspaceRole;
  sprint_manage_role: WorkspaceRole;
}

export type ReportsSettingsUpdate = Partial<ReportsSettings>;

export interface ReportCatalog {
  reports: ReportType[];
  can_view: boolean;
  /** Empty when the caller's role may not export. */
  export_formats: ExportFormat[];
  can_schedule: boolean;
  can_manage_sprints: boolean;
  presets: DatePreset[];
  limits: Record<string, number>;
  settings: ReportsSettings;
}

export interface ExportRequest {
  params: ReportParams;
  format: ExportFormat;
  date_format?: DateFormat;
  duration_format?: DurationFormat;
  /** Always queue a job, whatever the size. */
  background?: boolean;
}

export type ReportJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface ReportJob {
  id: string;
  kind: 'export' | 'schedule' | string;
  report_type: string;
  format: ExportFormat | string;
  status: ReportJobStatus | string;
  error: string | null;
  file_name: string | null;
  size_bytes: number | null;
  row_count: number | null;
  params: ReportParams;
  created_at: string;
  finished_at: string | null;
  expires_at: string | null;
  /** `/workspaces/…/report-jobs/{id}/download?token=…`, once done. */
  download_path: string | null;
}

export type SavedReportVisibility = 'private' | 'workspace';

export interface SavedReport {
  id: string;
  name: string;
  report_type: string;
  params: ReportParams;
  visibility: SavedReportVisibility;
  pinned: boolean;
  owner_id: string;
  owner_name: string | null;
  can_edit: boolean;
  schedule_count: number;
  created_at: string;
  updated_at: string;
}

export interface SavedReportCreate {
  name: string;
  report_type: string;
  params: ReportParams;
  visibility?: SavedReportVisibility;
  pinned?: boolean;
}

export type SavedReportUpdate = Partial<Omit<SavedReportCreate, 'report_type'>>;

export type Cadence = 'daily' | 'weekly' | 'monthly';

export interface ReportSchedule {
  id: string;
  saved_report_id: string;
  cadence: Cadence | string;
  weekday: number | null;
  day_of_month: number | null;
  hour_local: number;
  timezone: string;
  format: ExportFormat | string;
  recipients: { id: string; name: string | null }[];
  enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ScheduleCreate {
  cadence: Cadence;
  weekday?: number | null;
  day_of_month?: number | null;
  hour_local: number;
  timezone?: string | null;
  format: ExportFormat;
  recipients: string[];
  enabled?: boolean;
}

export type ScheduleUpdate = Partial<ScheduleCreate>;
