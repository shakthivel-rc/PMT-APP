import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { discardTimerApi, fetchTimerApi, startTimerApi, stopTimerApi } from '@/api/timer';
import { logoutUser, sessionExpired } from '@/features/auth/authSlice';
import { toDateKey } from '@/lib/dateKey';
import type { ActiveTimerSummary, TimerStartResult, TimerStopResult } from '@/types';

/*
 * The one running timer, shared by the header (which shows it on every screen) and the issue
 * drawer (which starts and stops it). A slice rather than component state because those two
 * must agree: stopping from the header has to change the drawer's button, and starting on an
 * issue has to appear in the header at once.
 *
 * **The server owns the clock.** The API answers `elapsed_seconds`, measured as it answered;
 * this side records the epoch second it *received* that answer and ticks from there. It never
 * computes "now minus `started_at`", which would compare the server's clock with this
 * machine's and show the difference between them as time worked.
 */

export interface TimerState {
  timer: ActiveTimerSummary | null;
  /** Epoch second at which `timer.elapsed_seconds` was true. */
  receivedAt: number;
  /** Bumped whenever a timer starts, stops or is discarded, so open panels can re-read. */
  changes: number;
}

const initialState: TimerState = { timer: null, receivedAt: 0, changes: 0 };

// The epoch second is taken here, in the thunk, because a reducer must be pure.
const received = () => Math.floor(Date.now() / 1000);

export const fetchTimer = createAsyncThunk('timer/fetch', async () => ({
  timer: await fetchTimerApi(),
  receivedAt: received(),
}));

export const startTimer = createAsyncThunk(
  'timer/start',
  async ({ workspaceId, issueId, note }: { workspaceId: string; issueId: string; note?: string }) => {
    // The work date is today *here*, sent explicitly: the API's fallback is UTC's today,
    // which is yesterday or tomorrow for part of every day in most of the world.
    const result: TimerStartResult = await startTimerApi(workspaceId, issueId, {
      work_date: toDateKey(new Date()),
      ...(note ? { note } : {}),
    });
    return { result, receivedAt: received() };
  },
);

export const stopTimer = createAsyncThunk('timer/stop', async (): Promise<TimerStopResult> => stopTimerApi());

export const discardTimer = createAsyncThunk('timer/discard', async () => discardTimerApi());

/**
 * The message of a rejected timer thunk. `unwrap()` rejects with RTK's *serialized* error — a
 * plain object, not an `Error` — so an `instanceof Error` check would throw away the API's own
 * explanation ("Time tracking is switched off in this workspace") for a generic one.
 */
export const timerFailure = (err: unknown, fallback: string): string =>
  typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' && err.message
    ? err.message
    : fallback;

/** Seconds on the clock at epoch second `now`. */
export const elapsedAt = (state: TimerState, now: number): number =>
  state.timer ? state.timer.elapsed_seconds + Math.max(0, now - state.receivedAt) : 0;

const timerSlice = createSlice({
  name: 'timer',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTimer.fulfilled, (state, action) => {
        state.timer = action.payload.timer;
        state.receivedAt = action.payload.receivedAt;
      })
      .addCase(startTimer.fulfilled, (state, action) => {
        state.timer = action.payload.result.timer;
        state.receivedAt = action.payload.receivedAt;
        state.changes += 1;
      })
      .addCase(stopTimer.fulfilled, (state) => {
        state.timer = null;
        state.changes += 1;
      })
      .addCase(discardTimer.fulfilled, (state) => {
        state.timer = null;
        state.changes += 1;
      })
      // A timer belongs to whoever was signed in. The next person on this tab must not see
      // it, and most sessions end through the 401 handler rather than a logout.
      .addCase(logoutUser.fulfilled, () => initialState)
      .addCase(sessionExpired, () => initialState);
  },
});

export default timerSlice.reducer;
