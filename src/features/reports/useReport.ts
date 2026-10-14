import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { runReportApi } from '@/api/reports';
import type { ReportParams, ReportResult } from '@/types/reports';
import { requestKey } from './params';

/*
 * Run a report as its parameters change (docs/design/08-reports.md §8.2): the plain
 * `src/api` helper with an AbortController, as every screen here fetches — no React Query.
 *
 * * **Debounced 300 ms**, so ticking three people in a filter is one request, not three.
 * * **The request in flight is cancelled** when the parameters move on; an answer for
 *   parameters the reader has already left never lands on screen.
 * * **The error keeps its status**: the page says something different for 413 (too many rows
 *   — export instead), 422 (no sprint to report on) and everything else.
 */

export const DEBOUNCE_MS = 300;

export interface ReportError {
  status: number;
  message: string;
  data: unknown;
}

export interface ReportState {
  key: string | null;
  result: ReportResult | null;
  error: ReportError | null;
}

export function useReport(workspaceId: string | null, type: string | null, params: ReportParams, enabled = true) {
  const key = workspaceId && type && enabled ? requestKey(workspaceId, type, params) : null;
  const [state, setState] = useState<ReportState>({ key: null, result: null, error: null });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!key || !workspaceId || !type) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      runReportApi(workspaceId, type, params, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setState({ key, result, error: null });
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          const error =
            cause instanceof ApiError
              ? { status: cause.status, message: cause.message, data: cause.data }
              : { status: 0, message: cause instanceof Error ? cause.message : 'The report could not be loaded.', data: null };
          setState({ key, result: null, error });
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `params` is captured through `key`, which is its stable spelling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reload]);

  const current = state.key === key;
  return {
    result: current ? state.result : null,
    error: current ? state.error : null,
    /** True from the first change until its answer — debounce included. */
    loading: Boolean(key) && !current,
    /** The previous answer while the next loads, so the page does not flash empty. */
    stale: !current ? state.result : null,
    refresh: () => {
      setState((s) => ({ ...s, key: null }));
      setReload((n) => n + 1);
    },
  };
}
