import type { ActiveTimerSummary, TimerStart, TimerStartResult, TimerStopResult } from '../types/index';
import { api } from './client';
import { workspacePath } from './workspaces';

/*
 * Your running timer (`routes/time_tracking.py` in pmt-api). A module of its own, apart from
 * `timeTracking.ts`, because the header shows the timer on every screen and so this lands in
 * the initial chunk, which has about 4 kB of headroom (bundle-budget.json). The rest of time
 * tracking is only ever imported by lazy screens and stays out of it.
 *
 * Every call here is safe to repeat. Starting the timer already running changes nothing,
 * stopping when nothing runs answers `entry: null`, and discarding twice discards nothing —
 * which is what makes "reload and look" a correct answer to a timed-out request.
 */

/** Your timer, or null. Nothing running is a normal state, so the API answers 200, not 404. */
export async function fetchTimerApi(): Promise<ActiveTimerSummary | null> {
  const res = await api.get<ActiveTimerSummary | null>('/timer');
  return res.data;
}

/** Start on an issue. A timer running elsewhere is stopped and saved first (`stopped_entry`). */
export async function startTimerApi(
  workspaceId: string,
  issueId: string,
  body: TimerStart,
): Promise<TimerStartResult> {
  const res = await api.post<TimerStartResult>(workspacePath(workspaceId, 'issues', issueId, 'timer'), body);
  return res.data;
}

export async function stopTimerApi(note?: string): Promise<TimerStopResult> {
  // Always an object: the client drops a falsy body, and the route expects JSON.
  const res = await api.post<TimerStopResult>('/timer/stop', note === undefined ? {} : { note });
  return res.data;
}

export async function discardTimerApi(): Promise<boolean> {
  const res = await api.delete<{ discarded: boolean }>('/timer');
  return res.data.discarded;
}
