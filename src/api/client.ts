const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export interface ApiResponse<T = any> {
  status: string;
  status_code: number;
  message: string;
  data: T;
}

class ApiError extends Error {
  status: number;
  /**
   * The `data` field of the `ErrorResponse` envelope, when the server sent one.
   *
   * An endpoint can put the *actionable* part of a refusal there rather than in `message` —
   * e.g. a 422 validation refusal carrying the list of offending fields in `data`. Keeping
   * only `message` would discard that list at the boundary, and a form written to render it
   * would show "Validation failed" with no indication of what to fix.
   *
   * `unknown` rather than a union: every consumer narrows it, and a type that enumerated
   * today's shapes would be wrong the first time an endpoint added one.
   */
  data: unknown;
  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * The `status` an `ApiError` carries when no HTTP response ever arrived.
 *
 * Deliberately not 408. That is a status a *server* can send, so a consumer switching on
 * it could not tell "the API said the request timed out" from "this client stopped
 * waiting", and the two want different advice. 0 is the platform's own spelling for "there
 * is no status" — `Response.status` is 0 for an opaque response — and nothing in this app
 * branches on it, which is the property that matters: the one status consumers *do* branch
 * on is 401 (`request()` below), and a client-side abort must never be mistaken for it.
 */
const NO_RESPONSE = 0;

// Registered by the app on mount — invoked when a session can't be recovered so the
// UI can sign the user out in-app (dispatch + toast + redirect) instead of a jarring
// full-page reload that destroys unsaved input and flashes the wrong theme.
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}
function handleUnauthorized(): void {
  clearTokens();
  unauthorizedHandler?.();
}

/**
 * How long a request may go unanswered before this client abandons it, in milliseconds.
 *
 * There was no ceiling here at all until 2026-08-27. `fetch()` has none of its own, so a
 * request against an API that accepted the connection and then stopped answering never
 * settled: the promise stayed pending, the spinner stayed up, and the screen was
 * indistinguishable from a slow one for as long as the tab stayed open. That is the one
 * failure a user cannot tell from "still working", and it is why this number exists at all.
 *
 * **15 s is a liveness check, not a latency budget.** Every endpoint in this API is answered
 * out of its own database — the only outside hop is the SMTP hand-off on the flows that
 * send an email — so any call taking more than a few seconds means something is wrong; 15 s
 * is simply the point past which waiting has stopped being informative. It also sits well
 * under a reverse proxy's default 60 s read timeout, so behind nginx this client gives up
 * first and says why.
 *
 * It is a judgement, not a measurement: this API has no p99 recorded anywhere yet, and
 * saying so is the honest half of the number. When one exists, re-derive this from it and
 * put the figure and the date here.
 */
export const DEFAULT_TIMEOUT_MS = 15_000;

function resolveTimeoutMs(override: number | null | undefined): number | null {
  // `undefined` means "no opinion" and `null` means "no ceiling", which are different
  // answers: the second is how a long-lived response says so, and it must survive here.
  return override !== undefined ? override : DEFAULT_TIMEOUT_MS;
}

/** A caller's own signal, ours, and what `fetch` should actually be handed. */
interface Budget {
  signal: AbortSignal | undefined;
  /** Ours, or `null` when this call has no ceiling. */
  timeout: AbortSignal | null;
  /** Drops the listeners the `AbortSignal.any` fallback installs; a no-op otherwise. */
  release: () => void;
}

/**
 * Compose the caller's abort signal with our timeout, without either one clobbering the other.
 *
 * ## What the two primitives cost in browser support
 *
 * This repo pins no browserslist and sets no `build.target`, so the only floor it states is
 * Vite 6.4's default `"modules"` — es2020 / chrome87 / edge88 / firefox78 / safari14
 * (`node_modules/vite/dist/node/constants.js:57`). That is a **syntax** target: esbuild
 * never polyfills an API, so it says what this bundle parses in, not what it runs in.
 * Measured against it:
 *
 *     AbortSignal.timeout()   Chrome 103 · Firefox 100 · Safari 16.0   (Sep 2022)
 *     AbortSignal.any()       Chrome 116 · Firefox 124 · Safari 17.4   (Mar 2024)
 *
 * Both are *above* the stated floor, and both are present everywhere the suites actually
 * run — Playwright's bundled Chromium/Firefox/WebKit, and jsdom 26, where the tests below
 * drive the real implementations rather than a stub. `any()` is the younger by eighteen
 * months and is the one a locked-down enterprise Safari or an ESR Firefox can plausibly
 * still be missing, which is what the fallback is for.
 *
 * Missing `any()` costs the composition; missing `timeout()` costs the ceiling and leaves
 * the behaviour this client had before 2026-08-27. Neither may cost the *request*: an
 * unguarded call to a missing static would throw `TypeError` before anything was sent and
 * take every screen in the app down with it, which is a far worse failure than the hang
 * this whole change exists to fix.
 */
function budgetFor(caller: AbortSignal | undefined, timeoutMs: number | null): Budget {
  const noop = () => {};
  const timeout =
    timeoutMs === null || typeof AbortSignal.timeout !== 'function'
      ? null
      : AbortSignal.timeout(timeoutMs);

  if (!timeout) return { signal: caller, timeout: null, release: noop };
  if (!caller) return { signal: timeout, timeout, release: noop };

  if (typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any([caller, timeout]), timeout, release: noop };
  }

  const composed = new AbortController();
  const forward = (from: AbortSignal) => () => composed.abort(from.reason);
  const onCallerAbort = forward(caller);
  const onTimeout = forward(timeout);
  if (caller.aborted) onCallerAbort();
  else caller.addEventListener('abort', onCallerAbort, { once: true });
  timeout.addEventListener('abort', onTimeout, { once: true });

  return {
    signal: composed.signal,
    timeout,
    // A caller's signal routinely outlives the request it was passed to — one component
    // holds one AbortController and fires several requests through it — so a listener left
    // behind here accumulates one entry per request until that component unmounts. Ours
    // is garbage the moment the request settles, but removing both is one line.
    release: () => {
      caller.removeEventListener('abort', onCallerAbort);
      timeout.removeEventListener('abort', onTimeout);
    },
  };
}

/**
 * The `Request` constructor the answer below was computed against, and the answer.
 *
 * Cached rather than recomputed because the probe is not free — 0.12 ms per accepted
 * signal, 0.05 ms per refused one, measured under Node 24 on 2026-08-27 — and keyed on the
 * constructor rather than on nothing because the implementation genuinely can be swapped at
 * runtime: MSW installs its own `fetch` in front of the platform's, and a test harness may
 * install its own `Request`. One probe per implementation is once per page load in a
 * browser, which is the cost this is worth.
 */
let probedAgainst: unknown = null;
let probeSaidYes = true;

/**
 * Will this runtime's `fetch` accept the `AbortSignal` we just built?
 *
 * In every browser: yes, and the fallback below is dead code there. The exception found on
 * 2026-08-27 is this repository's own test environment, and it is worth writing down
 * because it is not a mistake in the tests. Vitest's jsdom environment installs jsdom's
 * `AbortController`/`AbortSignal` over the globals while `fetch` stays Node's, and Node's
 * `fetch` brand-checks `RequestInit.signal` against its *internal* AbortSignal class. So
 * every signal reachable from user code there is refused:
 *
 *     TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal
 *
 * including — verified — the signal hanging off a `Request` that Node's own constructor had
 * just produced, because that constructor reads the *global* `AbortController` too. There
 * is no shim: the class it wants is not exported anywhere, so no amount of test setup can
 * hand it one. Any implementation of a fetch ceiling in this repo meets this wall; a
 * `fetch` polyfill that ignores `signal` is the same shape of problem in a real browser.
 *
 * `new Request(url, { signal })` runs exactly the validation `fetch` runs, and sends
 * nothing, so it answers the question without a network call and without string-matching an
 * error message. A runtime that says no keeps the ceiling and loses cancellation — the
 * promise still settles, which is the whole user-visible bug; the request it gave up on
 * keeps running in the background until the server or the socket ends it.
 */
function signalReachesFetch(signal: AbortSignal): boolean {
  if (typeof Request !== 'function') return true;
  if (probedAgainst === Request) return probeSaidYes;
  probedAgainst = Request;
  try {
    new Request('http://localhost/', { signal });
    probeSaidYes = true;
  } catch {
    probeSaidYes = false;
  }
  return probeSaidYes;
}

/**
 * The ceiling for a `fetch` that would not take our signal: settle on abort, and let the
 * request the runtime would not let us cancel run itself out.
 *
 * `Promise.race` attaches a handler to both sides, so the abandoned request rejecting later
 * is still a handled rejection rather than an unhandled one that would fail the suite.
 */
function raceAgainstAbort<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
  const aborted = new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  return Promise.race([run(), aborted]);
}

/**
 * Run one network exchange under a ceiling, and translate our own abort into an `ApiError`.
 *
 * `run` is handed the composed signal and must do **both** the fetch and the body read.
 * Headers-then-stall is a real hang and the nastier half of the one this fixes: `fetch`
 * resolves as soon as the headers arrive, so a body that never completes leaves `.json()`
 * pending for ever — the same never-settling promise, one `await` later. The signal that
 * bounds the fetch also bounds its body stream, which is why reading it has to happen in
 * here rather than after this returns.
 *
 * The three-way test in the catch is the load-bearing part, and the order is not the
 * obvious one:
 *
 * 1. **An `ApiError` is already ours and already readable**, so it leaves untouched. This
 *    is what stops a nested failure — a refresh that timed out, raised inside a caller's
 *    401 handling — from being re-labelled by whichever outer clock happened to fire while
 *    it was running.
 * 2. **A caller that aborted deliberately gets its own reason back**, unwrapped. A
 *    superseded search or an unmounted screen is not a failure and must not be reported as
 *    one; consumers check `err.name === 'AbortError'` and would never see it through a
 *    wrapper. It is asked *before* our own signal because `AbortSignal.any` aborts with
 *    whichever reason came first while our timer keeps running behind it — so by the time
 *    this runs, both signals can be aborted even though the caller won.
 * 3. Only then is our timeout the answer.
 *
 * The discriminator is the signal's `aborted` flag rather than `err.name === 'TimeoutError'`
 * because runtimes disagree about the name: some reject a timed-out fetch with a plain
 * `AbortError`, and a string comparison would silently stop matching in one of them.
 *
 * Anything else — a `TypeError` from a dropped connection, a `SyntaxError` from a body that
 * was not JSON — propagates exactly as it did before. Mapping those is a separate decision
 * about network-error copy and is not this change.
 */
async function within<T>(
  timeoutMs: number | null,
  caller: AbortSignal | undefined,
  onTimeout: (ms: number) => ApiError,
  run: (signal: AbortSignal | undefined) => Promise<T>
): Promise<T> {
  const budget = budgetFor(caller, timeoutMs);
  try {
    // Both branches abort on the same signal and land in the same catch, so the error a
    // caller sees does not depend on which one ran.
    return await (budget.signal && !signalReachesFetch(budget.signal)
      ? raceAgainstAbort(budget.signal, () => run(undefined))
      : run(budget.signal));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (caller?.aborted) throw err;
    if (budget.timeout?.aborted) throw onTimeout(timeoutMs ?? 0);
    throw err;
  } finally {
    budget.release();
  }
}

/**
 * What a person reads when the API stopped answering.
 *
 * The house rule for error copy is that it says what went wrong and what to do, with no
 * apology, so neither branch says "sorry" and both end in an instruction.
 *
 * The split on method is not decoration. A GET that timed out changed nothing, so "try
 * again" is complete advice. A POST/PUT/PATCH/DELETE that timed out may well have been
 * *applied* — the request reached the API, only the answer did not come back — and telling
 * someone to retry a change that already landed is how a duplicate gets created.
 */
function requestTimedOut(ms: number, method: string | undefined): ApiError {
  const seconds = Math.round(ms / 1000);
  const readOnly = (method ?? 'GET').toUpperCase() === 'GET';
  return new ApiError(
    readOnly
      ? `The API did not answer within ${seconds}s. It is unreachable or overloaded — try again.`
      : `The API did not answer within ${seconds}s, so whether the change was applied is ` +
        `unknown. Reload the page before sending it again.`,
    NO_RESPONSE
  );
}

/** Per-call escapes from the ceiling above. Both are optional and both are rarely needed. */
export interface CallOptions {
  /**
   * The caller's own abort — an unmounting screen, a superseded search. Composed with the
   * timeout rather than replacing it, so a caller that cancels does not also switch the
   * ceiling off.
   */
  signal?: AbortSignal;
  /**
   * `null` means **no ceiling**, which is the only correct setting for a response meant to
   * stay open (a Server-Sent Events stream, a long download). A number overrides the
   * default ceiling for this call only.
   */
  timeoutMs?: number | null;
  /**
   * The response may be a **file** rather than the JSON envelope (a report export). A
   * successful non-JSON answer then arrives as `data: DownloadedFile` inside a synthetic
   * envelope carrying the real status; a JSON answer (a 202 with a job, say) is unchanged.
   * Errors are still JSON and still throw `ApiError`, so a caller handles one shape.
   */
  file?: boolean;
}

/** A file the API sent back, with the name from `Content-Disposition`. */
export interface DownloadedFile {
  kind: 'file';
  blob: Blob;
  fileName: string;
  /** The `X-Report-Rows` header, when the API set one. */
  rows: number | null;
}

function fileNameOf(header: string | null, fallback: string): string {
  const match = header ? /filename="?([^";]+)"?/i.exec(header) : null;
  return match ? match[1] : fallback;
}

type RequestOptions = RequestInit & { timeoutMs?: number | null; file?: boolean };

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
  retryOnUnauthorized = true
): Promise<ApiResponse<T>> {
  const { timeoutMs, file, ...init } = options;
  const token = getAccessToken();
  // Every verb on `api` below JSON-serialises its body, and the API ships no multipart parser,
  // so JSON is the only content type this client sends. A derived project that adds uploads
  // needs its own verb that passes FormData through untouched and leaves Content-Type unset,
  // so the browser can write the multipart boundary.
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Everything that can hang lives inside `within`; everything that can sign the user out
  // lives after it. That split is the point. `handleUnauthorized()` clears the tokens and
  // bounces the app to /login, and it must be reachable *only* from a real 401 — a hung API
  // is not an expired session, and a timeout that reached that call would log people out of
  // a service that was merely slow, with a message telling them their session had expired.
  // Since a timeout throws out of here, `exchange.status` below is only ever a status the
  // API actually sent.
  const exchange = await within(
    resolveTimeoutMs(timeoutMs),
    init.signal ?? undefined,
    (ms) => requestTimedOut(ms, init.method),
    async (signal) => {
      const response = await fetch(`${BASE_URL}${endpoint}`, { ...init, headers, signal });
      // A 401's body is not read, exactly as before: nothing downstream uses it, and the
      // refresh-and-retry below is the only thing that acts on it.
      if (response.status === 401) return { status: 401, ok: false, body: null };
      if (file && response.ok && !(response.headers.get('Content-Type') ?? '').includes('json')) {
        const rows = response.headers.get('X-Report-Rows');
        const data: DownloadedFile = {
          kind: 'file',
          blob: await response.blob(),
          fileName: fileNameOf(response.headers.get('Content-Disposition'), 'download'),
          rows: rows === null ? null : Number(rows),
        };
        const body: ApiResponse<DownloadedFile> = {
          status: 'success', status_code: response.status, message: '', data,
        };
        return { status: response.status, ok: true, body };
      }
      const body: unknown = response.ok
        ? await response.json()
        : await response.json().catch(() => ({}));
      return { status: response.status, ok: response.ok, body };
    }
  );

  if (exchange.status === 401) {
    if (retryOnUnauthorized && endpoint !== '/user/refresh') {
      // A refresh that times out rejects rather than returning null, so this line throws
      // and the sign-out below is never reached. That is deliberate: null here means "the
      // API said no", and only that answer should end a session.
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        // The retry gets a fresh ceiling rather than the remainder of this one. A deadline
        // shared across the original, the refresh and the retry would hand the retry
        // whatever milliseconds were left — sometimes almost none — and fail it for a
        // reason nobody could act on. The cost is that a 401-then-refresh-then-retry can
        // take up to three ceilings end to end; each hop still settles on its own.
        return request<T>(endpoint, options, false);
      }
    }
    handleUnauthorized();
    throw new ApiError('Session expired. Please login again.', 401);
  }

  if (!exchange.ok) {
    const errorBody = (exchange.body ?? {}) as { message?: string; data?: unknown };
    throw new ApiError(
      errorBody.message || `Request failed with status ${exchange.status}`,
      exchange.status,
      errorBody.data ?? null
    );
  }

  return exchange.body as ApiResponse<T>;
}

/**
 * The refresh currently in flight, or null.
 *
 * Single-flight is not an optimisation here, it is the correctness fix. The backend
 * rotates the refresh token **in place**, so the previous one stops matching any session
 * row. Two parallel 401s therefore used to produce: refresh #1 succeeds and writes a fresh
 * pair, refresh #2 sends the now-stale token, gets 401 — and cleared the pair #1 had just
 * minted. Both requests failed and the user was bounced to /login.
 *
 * Screens that issue parallel requests on mount (RolesAndPermissions, rbacActions) meet
 * this, and the default access-token lifetime is one hour, so the trigger was simply
 * leaving the tab open and then clicking one of them. The symptom — "Session
 * expired" — is indistinguishable from a real expiry, so it was never reported accurately.
 */
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  // Concurrent callers await the same promise, so exactly one POST /user/refresh is issued
  // and everyone receives its result. Cleared in `finally` — including on rejection, or a
  // single network blip would wedge every later refresh onto a dead promise.
  //
  // 2026-08-27: that `finally` is now load-bearing for a second case. Before the ceiling in
  // `doRefresh`, "wedged onto a dead promise" had a worse sibling — wedged onto a promise
  // that never settles at all, which no `finally` can clear because it never runs. A hung
  // refresh is now a rejection like any other, so the slot is released and the next 401
  // refreshes again instead of joining a queue behind a request that will never finish.
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  // The ceiling matters more here than anywhere else in this file, because this promise is
  // *shared*. Without it, one hung `POST /user/refresh` leaves `refreshInFlight` pending
  // for ever: `finally` never runs, so the slot is never cleared, and every later 401 in
  // the tab awaits a promise that will never settle — a single stall wedging every
  // subsequent request, which is strictly worse than the hang it started as.
  //
  // The default ceiling fits: this endpoint is a session-row write and a token mint, with
  // nothing outside the API's process on its path.
  //
  // It **rejects** on timeout rather than returning null, and the difference is a
  // sign-out. Null is read by `request()` as "the API refused the refresh" and goes
  // straight to `handleUnauthorized()`; a timeout has heard nothing from the API at all,
  // and the stored pair is probably still perfectly good. So the `ApiError` propagates and
  // the tokens stay where they are.
  const body = await within(
    DEFAULT_TIMEOUT_MS,
    undefined,
    (ms) =>
      new ApiError(
        `Signing back in did not finish within ${Math.round(ms / 1000)}s. You are still ` +
          `signed in — the API is unreachable or overloaded, so try again.`,
        NO_RESPONSE
      ),
    async (signal) => {
      const response = await fetch(`${BASE_URL}/user/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal,
      });

      if (!response.ok) {
        // Deliberately does NOT clear tokens. Teardown belongs to `handleUnauthorized()`,
        // the single caller reached on every path where this returns null — so the loser
        // of any race can never delete a winner's freshly minted pair.
        return null;
      }

      return (await response.json()) as ApiResponse<{
        access_token: string;
        refresh_token: string;
      }>;
    }
  );

  if (body === null) {
    return null;
  }

  setTokens(body.data.access_token, body.data.refresh_token);
  return body.data.access_token;
}

// `options` is optional on every verb: the default ceiling applies unless a caller passes its
// own signal or a `timeoutMs` override (`null` for a response meant to stay open), so no
// caller in `api/` has to know the ceiling exists.
export const api = {
  get<T>(endpoint: string, options?: CallOptions): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'GET', ...options });
  },

  post<T>(endpoint: string, body?: unknown, options?: CallOptions): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  },

  put<T>(endpoint: string, body?: unknown, options?: CallOptions): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  },

  patch<T>(endpoint: string, body?: unknown, options?: CallOptions): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  },

  // A body is rare on DELETE but legal, and the API uses one where a set of ids is removed
  // in one call (`DELETE /sprints/{id}/issues`).
  delete<T>(endpoint: string, options?: CallOptions, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  },

};

export { ApiError };
