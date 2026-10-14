import { reportSearchParams } from '@/api/reports';
import type { WeekStart } from '@/types';
import type { DatePreset, ReportParams, ReportType } from '@/types/reports';
import { addDays, startOfWeek, toDateKey } from '@/lib/week';

/*
 * A report is its URL (docs/design/08-reports.md §8.1): every parameter lives in the query
 * string, so a report can be bookmarked, sent to someone, and saved by saving the query.
 * These are the two directions of that mapping, plus the arithmetic the filter bar needs to
 * label a preset before the API has answered.
 */

const LIST_KEYS = [
  'user_ids',
  'assignee_ids',
  'reporter_ids',
  'issue_ids',
  'types',
  'priorities',
  'status_categories',
  'group_by',
] as const;
const NUMBER_KEYS = ['rounding_minutes', 'sprint_count'] as const;
const BOOLEAN_KEYS = ['cumulative'] as const;
const STRING_KEYS = [
  'scope',
  'preset',
  'date_from',
  'date_to',
  'epic_id',
  'sprint_id',
  'billable',
  'unit',
  'bucket',
  'rounding_mode',
] as const;

/** URL keys that are not report parameters (the workspace, the "saved as" id, the view). */
export const PAGE_KEYS = ['workspace', 'saved', 'view'] as const;

/** Read the parameters out of a query string. Unknown keys are ignored. */
export function paramsFromSearch(search: URLSearchParams): ReportParams {
  const params: Record<string, unknown> = {};
  for (const key of STRING_KEYS) {
    const value = search.get(key);
    if (value) params[key] = value;
  }
  for (const key of LIST_KEYS) {
    // Repeated keys, or one comma-separated value: the API accepts both, and so does this.
    const values = search.getAll(key).flatMap((v) => v.split(',')).filter(Boolean);
    if (values.length) params[key] = values;
  }
  for (const key of NUMBER_KEYS) {
    const value = search.get(key);
    if (value !== null && value !== '' && Number.isFinite(Number(value))) params[key] = Number(value);
  }
  for (const key of BOOLEAN_KEYS) {
    const value = search.get(key);
    if (value === 'true' || value === 'false') params[key] = value === 'true';
  }
  return params as ReportParams;
}

/** The query string for `params`, keeping the page's own keys from `keep`. */
export function searchFromParams(params: ReportParams, keep?: URLSearchParams): URLSearchParams {
  const next = reportSearchParams(params);
  if (keep) {
    for (const key of PAGE_KEYS) {
      const value = keep.get(key);
      if (value) next.set(key, value);
    }
  }
  return next;
}

/** Only the parameters `report` reads — what is saved, exported and sent to the API. */
export function pickParams(report: ReportType | undefined, params: ReportParams): ReportParams {
  if (!report) return params;
  const allowed = new Set(report.params);
  return Object.fromEntries(Object.entries(params).filter(([key]) => allowed.has(key))) as ReportParams;
}

/** The preset a report uses when the URL names none — the API's own default (engine.py). */
export function defaultPreset(report: ReportType | undefined): DatePreset | null {
  if (!report) return null;
  if (report.dates === 'time' || report.dates === 'week') return 'this_week';
  if (report.dates === 'range') return 'last_30_days';
  return null;
}

const firstOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const lastDayBefore = (date: Date) => addDays(date, -1);

/**
 * The inclusive range a preset names, from `today` — the same rules as the API's
 * `preset_range` (utils/report_math.py): "this" periods run to their end, not to today.
 */
export function presetRange(preset: DatePreset, today: Date, weekStart: WeekStart = 'monday'): [string, string] | null {
  switch (preset) {
    case 'today':
      return [toDateKey(today), toDateKey(today)];
    case 'yesterday': {
      const day = addDays(today, -1);
      return [toDateKey(day), toDateKey(day)];
    }
    case 'this_week':
    case 'last_week': {
      const start = addDays(startOfWeek(today, weekStart), preset === 'last_week' ? -7 : 0);
      return [toDateKey(start), toDateKey(addDays(start, 6))];
    }
    case 'this_month':
    case 'last_month': {
      const start = addMonths(firstOfMonth(today), preset === 'last_month' ? -1 : 0);
      return [toDateKey(start), toDateKey(lastDayBefore(addMonths(start, 1)))];
    }
    case 'last_30_days':
      return [toDateKey(addDays(today, -29)), toDateKey(today)];
    case 'this_quarter':
    case 'last_quarter': {
      const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
      const start = addMonths(quarterStart, preset === 'last_quarter' ? -3 : 0);
      return [toDateKey(start), toDateKey(lastDayBefore(addMonths(start, 3)))];
    }
    case 'this_year':
      return [`${today.getFullYear()}-01-01`, `${today.getFullYear()}-12-31`];
    default:
      return null;
  }
}

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  last_week: 'Last week',
  this_month: 'This month',
  last_month: 'Last month',
  last_30_days: 'Last 30 days',
  this_quarter: 'This quarter',
  last_quarter: 'Last quarter',
  this_year: 'This year',
  custom: 'Custom range',
};

/** A stable string for "the same request", used to debounce and to ignore stale answers. */
export function requestKey(workspaceId: string, type: string, params: ReportParams): string {
  const query = reportSearchParams(params);
  query.sort();
  return `${workspaceId}|${type}|${query.toString()}`;
}
