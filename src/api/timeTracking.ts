import type {
  IssueTimeTracking,
  TimeEntryCreate,
  TimeEntryPage,
  TimeEntrySummary,
  TimeEntryUpdate,
  TimeReport,
  TimeTrackingSettings,
  TimeTrackingSettingsUpdate,
} from '../types/index';
import { api } from './client';
import { workspacePath } from './workspaces';

/*
 * Time logged on issues, the timesheet views and the workspace's settings
 * (`routes/time_tracking.py` in pmt-api). Payloads arrive as declared — see the top of
 * `workspaces.ts`. The running timer is in `timer.ts`, for the bundle reason given there.
 *
 * Refusals worth knowing, all surfaced as `ApiError.status`:
 * - 403: a member asking for someone else's time where the workspace shows only your own,
 *   or changing someone else's entry without being an admin.
 * - 404: no such entry, or one you cannot see — the same answer, deliberately.
 * - 422: tracking is switched off here, or the day has not started yet.
 */

/** Totals, roll-up, who logged what, and the newest 200 entries — the drawer's one read. */
export async function fetchIssueTimeApi(workspaceId: string, issueId: string): Promise<IssueTimeTracking> {
  const res = await api.get<IssueTimeTracking>(workspacePath(workspaceId, 'issues', issueId, 'time-tracking'));
  return res.data;
}

/**
 * Log time. Not idempotent: a retry after a timeout can log twice, which is why the client's
 * timeout copy for a POST says to reload before sending again.
 */
export async function createTimeEntryApi(
  workspaceId: string,
  issueId: string,
  body: TimeEntryCreate,
): Promise<TimeEntrySummary> {
  const res = await api.post<TimeEntrySummary>(workspacePath(workspaceId, 'issues', issueId, 'time-entries'), body);
  return res.data;
}

/** Omitted fields are left alone; an explicit null clears `note` or `started_at`. */
export async function updateTimeEntryApi(
  workspaceId: string,
  entryId: string,
  body: TimeEntryUpdate,
): Promise<TimeEntrySummary> {
  const res = await api.patch<TimeEntrySummary>(workspacePath(workspaceId, 'time-entries', entryId), body);
  return res.data;
}

export async function deleteTimeEntryApi(workspaceId: string, entryId: string): Promise<string> {
  const res = await api.delete<{ id: string }>(workspacePath(workspaceId, 'time-entries', entryId));
  return res.data.id;
}

export interface TimeEntryFilters {
  /** An account id, or `me`. Omitted: everyone the caller may see. */
  user_id?: string;
  issue_id?: string;
  /** Inclusive `YYYY-MM-DD` work dates. */
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export async function fetchTimeEntriesApi(workspaceId: string, filters: TimeEntryFilters = {}): Promise<TimeEntryPage> {
  // Paging is always explicit, for the reason `fetchIssuesApi` gives.
  const params = new URLSearchParams({ page: '1', limit: '50' });
  for (const [name, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(name, String(value));
  }
  const res = await api.get<TimeEntryPage>(`${workspacePath(workspaceId, 'time-entries')}?${params}`);
  return res.data;
}

/** Time summed by person, issue and day — the timesheet grid. At most 92 days per call. */
export async function fetchTimeReportApi(
  workspaceId: string,
  range: { date_from: string; date_to: string; user_id?: string },
): Promise<TimeReport> {
  const params = new URLSearchParams({ date_from: range.date_from, date_to: range.date_to });
  if (range.user_id) params.set('user_id', range.user_id);
  const res = await api.get<TimeReport>(`${workspacePath(workspaceId, 'time-report')}?${params}`);
  return res.data;
}

export async function fetchTimeSettingsApi(workspaceId: string): Promise<TimeTrackingSettings> {
  const res = await api.get<TimeTrackingSettings>(workspacePath(workspaceId, 'settings', 'time-tracking'));
  return res.data;
}

/** Admins only. Only the fields sent change. */
export async function updateTimeSettingsApi(
  workspaceId: string,
  body: TimeTrackingSettingsUpdate,
): Promise<TimeTrackingSettings> {
  const res = await api.patch<TimeTrackingSettings>(workspacePath(workspaceId, 'settings', 'time-tracking'), body);
  return res.data;
}
