import type {
  ExportRequest,
  ReportCatalog,
  ReportJob,
  ReportParams,
  ReportResult,
  ReportSchedule,
  ReportsSettings,
  ReportsSettingsUpdate,
  SavedReport,
  SavedReportCreate,
  SavedReportUpdate,
  ScheduleCreate,
  ScheduleUpdate,
} from '../types/reports';
import { api, type DownloadedFile } from './client';
import { workspacePath } from './workspaces';

/*
 * Reports (`routes/reports.py` in pmt-api; docs/design/08-reports.md §5.4).
 *
 * Refusals worth knowing, as `ApiError.status`:
 * - 400: the range is backwards, or longer than the report allows (`max_days`).
 * - 403: a guest where guests are off, or a role below the export / schedule setting.
 * - 404: no such report, saved report, job or scope — or one in another workspace.
 * - 413: more rows than a screen holds; `data.hint === 'export'`.
 * - 422: a sprint report without a sprint to report on.
 */

/**
 * Parameters as a query string: lists repeat their key, empty values are left out so the
 * API applies its defaults (and the cache key stays the same for the same request).
 */
export function reportSearchParams(params: ReportParams): URLSearchParams {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(name, String(item));
    } else {
      query.set(name, String(value));
    }
  }
  return query;
}

export async function fetchReportCatalogApi(workspaceId: string, signal?: AbortSignal): Promise<ReportCatalog> {
  const res = await api.get<ReportCatalog>(workspacePath(workspaceId, 'reports', 'catalog'), { signal });
  return res.data;
}

export async function runReportApi(
  workspaceId: string,
  reportType: string,
  params: ReportParams,
  signal?: AbortSignal,
): Promise<ReportResult> {
  const query = reportSearchParams(params).toString();
  const path = workspacePath(workspaceId, 'reports', reportType);
  // A year of flow history is the slowest thing here; it is still a few seconds at worst.
  const res = await api.get<ReportResult>(query ? `${path}?${query}` : path, { signal, timeoutMs: 60_000 });
  return res.data;
}

export type ExportOutcome = DownloadedFile | { kind: 'job'; job: ReportJob };

/**
 * Up to 5 000 rows the API answers with the file; more (or `background`) and it answers 202
 * with a job to poll. One call, two outcomes, told apart by `kind`.
 */
export async function exportReportApi(workspaceId: string, reportType: string, body: ExportRequest): Promise<ExportOutcome> {
  const res = await api.post<DownloadedFile | ReportJob>(workspacePath(workspaceId, 'reports', reportType, 'export'), body, {
    file: true,
    timeoutMs: 120_000,
  });
  const data = res.data as DownloadedFile | ReportJob;
  if ('kind' in data && data.kind === 'file') return data as DownloadedFile;
  return { kind: 'job', job: data as ReportJob };
}

export async function fetchReportJobsApi(workspaceId: string): Promise<ReportJob[]> {
  const res = await api.get<ReportJob[]>(workspacePath(workspaceId, 'report-jobs'));
  return res.data;
}

export async function fetchReportJobApi(workspaceId: string, jobId: string, signal?: AbortSignal): Promise<ReportJob> {
  const res = await api.get<ReportJob>(workspacePath(workspaceId, 'report-jobs', jobId), { signal });
  return res.data;
}

/** How often a waiting export asks after its job. */
export const REPORT_JOB_POLL_MS = 1_500;

export const isFinishedJob = (job: ReportJob): boolean => job.status === 'done' || job.status === 'failed';

/**
 * Ask after a job until it is done or failed, reporting each answer through `onUpdate`.
 * Stops (throwing an `AbortError`) when `signal` aborts — the dialog closing, say; the job
 * itself carries on, and the Reports home lists it with its download link.
 */
export async function waitForReportJobApi(
  workspaceId: string,
  job: ReportJob,
  { signal, onUpdate, intervalMs = REPORT_JOB_POLL_MS }: { signal?: AbortSignal; onUpdate?: (job: ReportJob) => void; intervalMs?: number } = {},
): Promise<ReportJob> {
  let current = job;
  while (!isFinishedJob(current)) {
    if (signal?.aborted) throw new DOMException('Stopped waiting for the export.', 'AbortError');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, intervalMs);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Stopped waiting for the export.', 'AbortError'));
        },
        { once: true },
      );
    });
    current = await fetchReportJobApi(workspaceId, current.id, signal);
    onUpdate?.(current);
  }
  return current;
}

/** `job.download_path` is already a signed, workspace-relative API path. */
export async function downloadReportJobApi(job: ReportJob): Promise<DownloadedFile> {
  if (!job.download_path) throw new Error('This export has no file yet.');
  const res = await api.get<DownloadedFile>(job.download_path, { file: true, timeoutMs: 120_000 });
  return res.data;
}

/** Hand a downloaded file to the browser's save flow. */
export function saveFile(file: DownloadedFile): void {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: revoking synchronously can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ---- saved reports -----------------------------------------------------------------------

export async function fetchSavedReportsApi(workspaceId: string): Promise<SavedReport[]> {
  const res = await api.get<SavedReport[]>(workspacePath(workspaceId, 'saved-reports'));
  return res.data;
}

export async function fetchSavedReportApi(workspaceId: string, savedId: string): Promise<SavedReport> {
  const res = await api.get<SavedReport>(workspacePath(workspaceId, 'saved-reports', savedId));
  return res.data;
}

export async function createSavedReportApi(workspaceId: string, body: SavedReportCreate): Promise<SavedReport> {
  const res = await api.post<SavedReport>(workspacePath(workspaceId, 'saved-reports'), body);
  return res.data;
}

export async function updateSavedReportApi(workspaceId: string, savedId: string, body: SavedReportUpdate): Promise<SavedReport> {
  const res = await api.patch<SavedReport>(workspacePath(workspaceId, 'saved-reports', savedId), body);
  return res.data;
}

export async function deleteSavedReportApi(workspaceId: string, savedId: string): Promise<void> {
  await api.delete(workspacePath(workspaceId, 'saved-reports', savedId));
}

// ---- schedules ---------------------------------------------------------------------------

export async function fetchSchedulesApi(workspaceId: string, savedId: string): Promise<ReportSchedule[]> {
  const res = await api.get<ReportSchedule[]>(workspacePath(workspaceId, 'saved-reports', savedId, 'schedules'));
  return res.data;
}

export async function createScheduleApi(workspaceId: string, savedId: string, body: ScheduleCreate): Promise<ReportSchedule> {
  const res = await api.post<ReportSchedule>(workspacePath(workspaceId, 'saved-reports', savedId, 'schedules'), body);
  return res.data;
}

export async function updateScheduleApi(
  workspaceId: string,
  savedId: string,
  scheduleId: string,
  body: ScheduleUpdate,
): Promise<ReportSchedule> {
  const res = await api.patch<ReportSchedule>(
    workspacePath(workspaceId, 'saved-reports', savedId, 'schedules', scheduleId),
    body,
  );
  return res.data;
}

export async function deleteScheduleApi(workspaceId: string, savedId: string, scheduleId: string): Promise<void> {
  await api.delete(workspacePath(workspaceId, 'saved-reports', savedId, 'schedules', scheduleId));
}

/** Send it now, whatever the schedule says. Returns the queued job ids. */
export async function runScheduleNowApi(workspaceId: string, savedId: string, scheduleId: string): Promise<string[]> {
  const res = await api.post<{ job_ids: string[] }>(
    workspacePath(workspaceId, 'saved-reports', savedId, 'schedules', scheduleId, 'run'),
  );
  return res.data.job_ids;
}

// ---- settings ----------------------------------------------------------------------------

export async function fetchReportsSettingsApi(workspaceId: string): Promise<ReportsSettings> {
  const res = await api.get<ReportsSettings>(workspacePath(workspaceId, 'settings', 'reports'));
  return res.data;
}

export async function updateReportsSettingsApi(workspaceId: string, body: ReportsSettingsUpdate): Promise<ReportsSettings> {
  const res = await api.patch<ReportsSettings>(workspacePath(workspaceId, 'settings', 'reports'), body);
  return res.data;
}
