import type {
  AIJobSummary,
  Backlog,
  BacklogRank,
  Board,
  CommentCreate,
  CommentSummary,
  IssueCard,
  IssueCreate,
  IssueDetail,
  IssueKeyResolution,
  IssueMove,
  IssuePage,
  IssuePriority,
  IssueType,
  IssueUpdate,
} from '../types/index';
import { api, type CallOptions } from './client';
import { workspacePath } from './workspaces';

/*
 * The issue, board, comment and AI routes (`routes/issues.py` in pmt-api). Payloads are
 * returned as they arrive, for the reason given at the top of `workspaces.ts`.
 *
 * Refusals every write here can meet, as `ApiError.status` (09-restructuring.md §3.4, §4):
 * - 423: the issue's list, folder or space is archived, or the space is frozen while it is
 *   reorganised. The `message` says which and what lifts it — show it as it is.
 * - 422: a rule — the hierarchy (a task under a story), an epic without an owner or
 *   criteria, blocking without a reason, or a move the restricted workflow does not allow
 *   (the message names where the issue CAN go).
 * - 409: a stale `version` on PATCH, or a WIP limit under the `block` policy.
 */

/**
 * The board's filters (09-restructuring.md §5.1), the same on the board, the list route and
 * the backlog, so a saved view means the same thing whichever one it opens. Omitted, null and
 * empty values are not sent; an array is sent as a repeated parameter (`type=bug&type=task`).
 */
export interface BoardFilters {
  /** An account id, `me`, or `none` for unassigned work. */
  assignee_id?: string;
  type?: IssueType[];
  priority?: IssuePriority[];
  /** A title substring, or an issue key — an old key still finds the issue that moved. */
  q?: string;
  /** true: only blocked work; false: only unblocked work. */
  blocked?: boolean;
  /** An issue — usually an epic — and everything beneath it. */
  epic_id?: string;
}

/** Every filter the list route takes. */
export interface IssueFilters extends Omit<BoardFilters, 'type'> {
  list_id?: string;
  space_id?: string;
  sprint_id?: string;
  status_id?: string;
  type?: IssueType | IssueType[];
  page?: number;
  limit?: number;
}

/** A board draws one list, a whole space (every list), or a sprint (across the space's lists). */
export type BoardScope = { list_id: string } | { space_id: string } | { sprint_id: string };

/**
 * A write the server answered with something worth showing beside the result. Today that is
 * a WIP limit gone over under the `warn` policy: the move or create succeeded, and the API
 * appends `"<Stage> is over its WIP limit (5 of 4)."` to its message (§4.7).
 */
export interface Noticed<T> {
  value: T;
  /** The clause the server added to its plain success message, or null when it added none. */
  notice: string | null;
}

/** The clause after `base`, when the server's message is `"<base>. <clause>"`. */
export function noticeAfter(message: string | undefined, base: string): string | null {
  const prefix = `${base}. `;
  return message?.startsWith(prefix) ? message.slice(prefix.length) || null : null;
}

/** Query parameters from a filter object: arrays repeated, booleans as `true`/`false`. */
export function filterParams(filters: object, params = new URLSearchParams()): URLSearchParams {
  for (const [name, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(name, String(item));
    } else if (value !== undefined && value !== null && value !== '') {
      params.set(name, String(value));
    }
  }
  return params;
}

const issuePath = (workspaceId: string, issueId: string, ...segments: string[]) =>
  workspacePath(workspaceId, 'issues', issueId, ...segments);

export async function fetchIssuesApi(workspaceId: string, filters: IssueFilters = {}): Promise<IssuePage> {
  // `page` and `limit` are always sent, so the paging arithmetic on this side never rests on
  // a default the server could change without telling anyone.
  const params = filterParams(filters, new URLSearchParams({ page: '1', limit: '50' }));
  const res = await api.get<IssuePage>(`${workspacePath(workspaceId, 'issues')}?${params}`);
  return res.data;
}

export async function fetchIssueApi(workspaceId: string, issueId: string): Promise<IssueDetail> {
  const res = await api.get<IssueDetail>(issuePath(workspaceId, issueId));
  return res.data;
}

/** Lands at the bottom of its status column, and at the bottom of the space's backlog. */
export async function createIssueApi(workspaceId: string, body: IssueCreate): Promise<Noticed<IssueDetail>> {
  const res = await api.post<IssueDetail>(workspacePath(workspaceId, 'issues'), body);
  return { value: res.data, notice: noticeAfter(res.message, 'Issue created') };
}

/** A 409 means `body.version` is stale: someone changed the issue since it was read. */
export async function updateIssueApi(
  workspaceId: string,
  issueId: string,
  body: IssueUpdate,
): Promise<IssueDetail> {
  const res = await api.patch<IssueDetail>(issuePath(workspaceId, issueId), body);
  return res.data;
}

/**
 * A drop on the board. The answer carries the issue's new `rank` — the server computes it
 * from the two neighbours named in `body`, and this side never invents one — and, under the
 * `warn` policy, the WIP limit the move went over.
 */
export async function moveIssueApi(workspaceId: string, issueId: string, body: IssueMove): Promise<Noticed<IssueCard>> {
  const res = await api.post<IssueCard>(issuePath(workspaceId, issueId, 'move'), body);
  return { value: res.data, notice: noticeAfter(res.message, 'Issue moved') };
}

/**
 * A drop in the space's backlog. Planning, like sprint membership: it bumps no `version`, so
 * nobody with the issue open gets a 409 because a lead reordered the backlog.
 */
export async function rankInBacklogApi(workspaceId: string, issueId: string, body: BacklogRank): Promise<IssueCard> {
  const res = await api.post<IssueCard>(issuePath(workspaceId, issueId, 'backlog-rank'), body);
  return res.data;
}

/** The space's planning view: its open sprints, then its ordered backlog, then its open epics. */
export async function fetchBacklogApi(
  workspaceId: string,
  spaceId: string,
  filters: BoardFilters & { include_closed?: boolean } = {},
): Promise<Backlog> {
  const query = filterParams(filters).toString();
  const res = await api.get<Backlog>(`${workspacePath(workspaceId, 'spaces', spaceId, 'backlog')}${query ? `?${query}` : ''}`);
  return res.data;
}

/**
 * Where a key points now — the current key, a space's old key, or a key the issue had before
 * it moved. A deep link redirects to `current_key` when it differs. Case-insensitive; a key
 * that does not resolve is a 404.
 */
export async function resolveIssueKeyApi(workspaceId: string, key: string): Promise<IssueKeyResolution> {
  const res = await api.get<IssueKeyResolution>(workspacePath(workspaceId, 'issue-keys', key));
  return res.data;
}

export async function deleteIssueApi(workspaceId: string, issueId: string): Promise<string> {
  const res = await api.delete<{ id: string }>(issuePath(workspaceId, issueId));
  return res.data.id;
}

/** Oldest first. */
export async function fetchCommentsApi(workspaceId: string, issueId: string): Promise<CommentSummary[]> {
  const res = await api.get<CommentSummary[]>(issuePath(workspaceId, issueId, 'comments'));
  return res.data;
}

export async function createCommentApi(
  workspaceId: string,
  issueId: string,
  body: CommentCreate,
): Promise<CommentSummary> {
  const res = await api.post<CommentSummary>(issuePath(workspaceId, issueId, 'comments'), body);
  return res.data;
}

export async function updateCommentApi(
  workspaceId: string,
  issueId: string,
  commentId: string,
  body: { body: string; attachment_ids?: string[] },
): Promise<CommentSummary> {
  const res = await api.patch<CommentSummary>(issuePath(workspaceId, issueId, 'comments', commentId), body);
  return res.data;
}

export async function deleteCommentApi(
  workspaceId: string,
  issueId: string,
  commentId: string,
): Promise<void> {
  await api.delete(issuePath(workspaceId, issueId, 'comments', commentId));
}

/** `filters` narrow the cards, never the columns or their WIP counts (`board.filtered` says whether any did). */
export async function fetchBoardApi(workspaceId: string, scope: BoardScope, filters: BoardFilters = {}): Promise<Board> {
  const params = filterParams(filters, new URLSearchParams(scope));
  const res = await api.get<Board>(`${workspacePath(workspaceId, 'board')}?${params}`);
  return res.data;
}

/**
 * Ask for a summary of the issue's thread. Answered 202 with a job to poll — or with one that
 * is already `succeeded` when an unchanged thread's earlier summary was reused.
 *
 * A 503 means AI is switched off on this deployment. Its `message` is written for people, so
 * callers show it as it is rather than a generic failure.
 */
export async function requestThreadSummaryApi(workspaceId: string, issueId: string): Promise<AIJobSummary> {
  const res = await api.post<AIJobSummary>(issuePath(workspaceId, issueId, 'summary'));
  return res.data;
}

export async function fetchAIJobApi(
  workspaceId: string,
  jobId: string,
  options?: CallOptions,
): Promise<AIJobSummary> {
  const res = await api.get<AIJobSummary>(workspacePath(workspaceId, 'ai-jobs', jobId), options);
  return res.data;
}

export const isTerminalJob = (job: AIJobSummary): boolean =>
  job.status === 'succeeded' || job.status === 'failed';

/**
 * How often a pending job is asked about. A summary takes seconds, not milliseconds, so a
 * tighter loop would mostly measure how fast the API can say "still running".
 */
export const AI_JOB_POLL_MS = 1_500;

/**
 * How long anyone is kept waiting. Past this the job is not declared failed — it may still
 * finish — but a spinner that has run for two minutes has stopped telling anyone anything.
 */
export const AI_JOB_MAX_WAIT_MS = 120_000;

export interface WaitOptions {
  intervalMs?: number;
  maxWaitMs?: number;
  /** Stops the loop — an unmounted drawer, a second request superseding the first. */
  signal?: AbortSignal;
}

/** A timer that an abort cuts short, rejecting with the signal's own reason. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Poll a job until it is terminal, and return it — `failed` included, since its `error` is
 * the thing to show. Rejects with the signal's reason when aborted, and with a readable
 * `Error` once `maxWaitMs` has passed.
 *
 * Sequential rather than `setInterval`: the next question is asked only after the previous
 * answer arrived, so a slow API is never sent a queue of overlapping polls.
 */
export async function waitForAIJobApi(
  workspaceId: string,
  jobId: string,
  { intervalMs = AI_JOB_POLL_MS, maxWaitMs = AI_JOB_MAX_WAIT_MS, signal }: WaitOptions = {},
): Promise<AIJobSummary> {
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    await pause(intervalMs, signal);
    const job = await fetchAIJobApi(workspaceId, jobId, { signal });
    if (isTerminalJob(job)) return job;
    if (Date.now() + intervalMs > deadline) {
      throw new Error(
        `The summary did not finish within ${Math.round(maxWaitMs / 1000)}s. Try again in a moment.`,
      );
    }
  }
}
